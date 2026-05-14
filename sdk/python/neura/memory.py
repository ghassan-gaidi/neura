"""Memory operations — store, search, update, delete."""

from typing import Any, Optional
from .client import HttpClient


class MemoryAPI:
    """High-level memory operations."""

    def __init__(self, client: HttpClient):
        self._client = client

    def create(
        self,
        content: str,
        metadata: Optional[dict] = None,
        tags: Optional[list[str]] = None,
        importance: int = 0,
        expires_at: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> dict:
        """Store a memory with auto-embedding."""
        body = {"content": content}
        if metadata:
            body["metadata"] = metadata
        if tags:
            body["tags"] = tags
        if importance:
            body["importance"] = importance
        if expires_at:
            body["expires_at"] = expires_at

        result = self._client.request("POST", "/api/memory", body, idempotency_key)
        return result["data"]

    def search(self, query: str, limit: int = 10) -> list[dict]:
        """Semantic search by query text."""
        result = self._client.request(
            "GET", f"/api/memory?query={__import__('urllib.parse').parse.quote(query)}&limit={limit}"
        )
        return result["data"]

    def search_advanced(
        self,
        query: Optional[str] = None,
        filters: Optional[dict] = None,
        limit: int = 10,
        min_score: float = 0.0,
    ) -> list[dict]:
        """Advanced search with filters."""
        body = {}
        if query:
            body["query"] = query
        if filters:
            body["filters"] = filters
        body["limit"] = limit
        body["min_score"] = min_score

        result = self._client.request("POST", "/api/memory/search", body)
        return result["data"]

    def recent(self, limit: int = 10) -> list[dict]:
        """Get the most recent memories."""
        result = self._client.request("GET", f"/api/memory?limit={limit}")
        return result["data"]

    def update(self, memory_id: str, **kwargs) -> dict:
        """Update a memory's fields."""
        result = self._client.request("PATCH", f"/api/memory/{memory_id}", kwargs)
        return result["data"]

    def delete(self, memory_id: str) -> None:
        """Delete a memory."""
        self._client.request("DELETE", f"/api/memory/{memory_id}")
