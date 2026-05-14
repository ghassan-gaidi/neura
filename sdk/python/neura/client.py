"""Low-level HTTP client with retry support."""

import time
import json
import uuid
from typing import Any, Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError


class NeuraHttpError(Exception):
    """Raised when the API returns an error response."""

    def __init__(self, status: int, error: dict):
        self.status = status
        self.code = error.get("code", "unknown")
        self.message = error.get("message", "Unknown error")
        self.action = error.get("action")
        self.retry_after = error.get("retry_after")
        self.docs_url = error.get("docs_url")
        super().__init__(self.message)

    def __repr__(self):
        return f"NeuraHttpError({self.status}: {self.code} — {self.message})"


class HttpClient:
    """Handles HTTP communication with the Neura API."""

    def __init__(self, base_url: str, api_key: str, max_retries: int = 3):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.max_retries = max_retries

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
                error_body = json.loads(e.read().decode()) if e.code != 429 else {}
                error = error_body.get("error", {}) if error_body else {}

                if e.code == 429 and attempt < self.max_retries:
                    retry_after = error.get("retry_after", 2 ** attempt)
                    time.sleep(retry_after)
                    continue

                if e.code == 402:
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
