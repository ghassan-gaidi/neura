"""Admin operations — API keys, transactions, usage stats."""
from typing import Any, Optional
from .client import HttpClient


class AdminAPI:
    """High-level admin operations."""

    def __init__(self, client: HttpClient):
        self._client = client

    def list_keys(self) -> list[dict]:
        """List all API keys for this tenant."""
        result = self._client.request("GET", "/api/admin/keys")
        return result["data"]

    def create_key(self, label: Optional[str] = None) -> dict:
        """Create a new API key. Returns the raw key once."""
        body = {}
        if label:
            body["label"] = label
        result = self._client.request("POST", "/api/admin/keys", body)
        return result["data"]

    def revoke_key(self, key_id: str) -> None:
        """Revoke (deactivate) an API key by ID."""
        self._client.request("DELETE", f"/api/admin/keys/{key_id}")

    def list_transactions(self, limit: int = 20) -> list[dict]:
        """List credit transaction history."""
        result = self._client.request("GET", f"/api/admin/transactions?limit={limit}")
        return result["data"]

    def get_usage(self, days: int = 7) -> dict:
        """Get usage statistics."""
        result = self._client.request("GET", f"/api/admin/usage?days={days}")
        return result["data"]


class CreditsAPI:
    """Credits operations."""

    def __init__(self, client: HttpClient):
        self._client = client

    def balance(self) -> dict:
        """Get current credit balance and pricing info."""
        result = self._client.request("GET", "/api/credits")
        return result["data"]
