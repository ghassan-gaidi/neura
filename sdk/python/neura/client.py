"""Low-level HTTP client with retry and auto-payment support."""

import time
import json
from typing import Any, Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from .payment import handle_payment_required, wait_for_confirmations, X402Details


class NeuraHttpError(Exception):
    """Raised when the API returns an error response."""

    def __init__(self, status: int, error: dict):
        self.status = status
        self.code = error.get("code", "unknown")
        self.message = error.get("message", "Unknown error")
        self.action = error.get("action")
        self.retry_after = error.get("retry_after")
        self.docs_url = error.get("docs_url")
        self.x402 = X402Details(error.get("x402", {})) if error.get("x402") else None
        super().__init__(self.message)

    def __repr__(self):
        return f"NeuraHttpError({self.status}: {self.code} — {self.message})"


class HttpClient:
    """Handles HTTP communication with the Neura API."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        max_retries: int = 3,
        auto_pay: Optional[dict] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.max_retries = max_retries
        self.auto_pay = auto_pay

    def request(
        self,
        method: str,
        path: str,
        body: Optional[dict] = None,
        idempotency_key: Optional[str] = None,
    ) -> dict:
        url = f"{self.base_url}{path}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        data = json.dumps(body).encode() if body else None

        for attempt in range(self.max_retries + 1):
            try:
                req = Request(url, data=data, headers=headers, method=method)
                with urlopen(req, timeout=30) as resp:
                    return json.loads(resp.read().decode())

            except HTTPError as e:
                error_body_raw = e.read().decode()
                error_body = json.loads(error_body_raw) if error_body_raw else {}
                error = error_body.get("error", {}) if error_body else {}

                if e.code == 429 and attempt < self.max_retries:
                    retry_after = error.get("retry_after", 2 ** attempt)
                    time.sleep(retry_after)
                    continue

                if e.code == 402 and self.auto_pay and error.get("x402"):
                    x402 = X402Details(error["x402"])
                    try:
                        import asyncio
                        tx_hash = asyncio.run(handle_payment_required(self.auto_pay, x402))
                        if tx_hash:
                            # Wait for confirmation
                            wait_for_confirmations(tx_hash, 2, self.auto_pay.get("rpc_url"))

                            # Call verify endpoint
                            import asyncio
                            verify_body = json.dumps({"payment_tx": tx_hash}).encode()
                            verify_req = Request(
                                f"{self.base_url}/api/payments/verify",
                                data=verify_body,
                                headers={
                                    "Authorization": f"Bearer {self.api_key}",
                                    "Content-Type": "application/json",
                                },
                                method="POST",
                            )
                            with urlopen(verify_req, timeout=30) as vr:
                                pass  # Payment redeemed, retry original request
                            continue
                    except Exception as pay_err:
                        raise NeuraHttpError(e.code, {
                            "code": "payment_failed",
                            "message": f"Auto-payment failed: {pay_err}",
                        })

                    raise NeuraHttpError(e.code, error)

                raise NeuraHttpError(e.code, error)

            except Exception as e:
                if attempt < self.max_retries:
                    time.sleep(0.5 * (2 ** attempt))
                    continue
                raise NeuraHttpError(0, {
                    "code": "network_error",
                    "message": f"Request failed: {e}",
                    "action": "retry",
                })

        raise NeuraHttpError(0, {
            "code": "max_retries",
            "message": "Max retries exceeded",
            "action": "check_network",
        })
