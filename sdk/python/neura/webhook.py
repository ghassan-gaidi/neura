"""Webhook operations — register, list, manage webhook endpoints."""
from typing import Any, Optional
from .client import HttpClient


class WebhookAPI:
    """High-level webhook operations."""

    def __init__(self, client: HttpClient):
        self._client = client

    def create(self, url: str, events: list[str], secret: Optional[str] = None) -> dict:
        """Register a webhook for event notifications."""
        body = {"url": url, "events": events}
        if secret:
            body["secret"] = secret
        result = self._client.request("POST", "/api/webhooks", body)
        return result["data"]

    def list(self) -> list[dict]:
        """List all registered webhooks."""
        result = self._client.request("GET", "/api/webhooks")
        return result["data"]

    def get(self, webhook_id: str) -> dict:
        """Get webhook details by ID."""
        result = self._client.request("GET", f"/api/webhooks/{webhook_id}")
        return result["data"]

    def update(self, webhook_id: str, **kwargs) -> dict:
        """Update a webhook's url, events, or secret."""
        result = self._client.request("PATCH", f"/api/webhooks/{webhook_id}", kwargs)
        return result["data"]

    def delete(self, webhook_id: str) -> None:
        """Delete a webhook."""
        self._client.request("DELETE", f"/api/webhooks/{webhook_id}")

    def retry_failed(self) -> dict:
        """Trigger retry of all failed webhook deliveries due for retry."""
        result = self._client.request("POST", "/api/webhooks/retry")
        return result["data"]
