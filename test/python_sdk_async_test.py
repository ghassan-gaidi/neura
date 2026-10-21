"""Behavioral test for the Python SDK's auto-payment async handling.

Verifies that a 402 response handled from inside a running event loop raises a
clear, actionable error instead of the opaque
"RuntimeError: asyncio.run() cannot be called from a running event loop".
"""

import asyncio
import io
import json
import os
import sys
import unittest
from unittest import mock
from urllib.error import HTTPError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "sdk", "python"))

from neura.client import HttpClient, NeuraHttpError  # noqa: E402
from neura.payment import handle_payment_required  # noqa: E402


class _FakeResponse:
    def __init__(self, payload: bytes = b"{}"):
        self._payload = payload

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def _make_402():
    """A real urllib HTTPError, which is what the SDK catches."""
    body = json.dumps(
        {
            "error": {
                "code": "payment_required",
                "message": "Insufficient credits",
                "action": "send_payment",
                "x402": {
                    "chain": "base",
                    "token": "USDC",
                    "amount": "0.10",
                    "recipient": "0xabc",
                    "credits": 100,
                },
            }
        }
    ).encode()
    return HTTPError(
        "https://neura.test/api/memory",
        402,
        "Payment Required",
        {},
        io.BytesIO(body),
    )


class AsyncContextTests(unittest.TestCase):
    def test_auto_payment_in_running_loop_raises_actionable_error(self):
        client = HttpClient(
            base_url="https://neura.test",
            api_key="sk-test",
            auto_pay={"callback": lambda *a, **k: None},
        )

        async def run():
            with mock.patch(
                "neura.client.urlopen", side_effect=_make_402()
            ):
                with self.assertRaises(NeuraHttpError) as ctx:
                    client.request("GET", "/api/memory")
                return ctx.exception

        err = asyncio.run(run())
        self.assertEqual(err.code, "async_context_unsupported")
        self.assertEqual(err.action, "handle_payment_manually")
        self.assertIn("synchronous context", err.message)

    def test_auto_payment_outside_a_loop_is_unchanged(self):
        """Outside a running loop the SDK still drives the coroutine itself."""
        client = HttpClient(
            base_url="https://neura.test",
            api_key="sk-test",
            auto_pay={"callback": lambda *a, **k: None},
        )

        calls = []

        async def fake_handle(auto_pay, x402):
            calls.append(x402)
            return None  # no tx hash -> SDK raises the original 402

        with mock.patch(
            "neura.client.urlopen", side_effect=_make_402()
        ), mock.patch(
            "neura.client.handle_payment_required", fake_handle
        ):
            with self.assertRaises(NeuraHttpError) as ctx:
                client.request("GET", "/api/memory")

        self.assertEqual(len(calls), 1, "the payment callback should have been awaited")
        self.assertNotEqual(ctx.exception.code, "async_context_unsupported")


if __name__ == "__main__":
    unittest.main()
