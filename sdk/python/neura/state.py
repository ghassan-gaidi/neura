"""State operations — persistent key-value storage."""

from typing import Any, Optional
from .client import HttpClient


class StateAPI:
    """High-level state operations."""

    def __init__(self, client: HttpClient):
        self._client = client

    def set(self, key: str, value: Any, idempotency_key: Optional[str] = None) -> dict:
        """Set a key-value state entry."""
        result = self._client.request(
            "POST", "/api/state", {"key": key, "value": value}, idempotency_key
        )
        return result["data"]

    def get(self, key: str) -> dict:
        """Get a state entry by key."""
        result = self._client.request("GET", f"/api/state/{__import__('urllib.parse').parse.quote(key)}")
        return result["data"]

    def list(self) -> list[dict]:
        """List all state entries."""
        result = self._client.request("GET", "/api/state")
        return result["data"]

    def delete(self, key: str) -> None:
        """Delete a state entry."""
        self._client.request("DELETE", f"/api/state/{__import__('urllib.parse').parse.quote(key)}")
