"""Memory operations — store, search, batch, update, delete, share."""
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
        quoted = __import__("urllib.parse").parse.quote(query)
        result = self._client.request(
            "GET", f"/api/memory?query={quoted}&limit={limit}"
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
        body = {"limit": limit, "min_score": min_score}
        if query:
            body["query"] = query
        if filters:
            body["filters"] = filters
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

    def batch_create(self, memories: list[dict]) -> dict:
        """Store multiple memories at once (max 25). Costs 1 credit each.

        Args:
            memories: List of dicts with keys: content, metadata?, tags?, importance?, expires_at?

        Returns:
            {"stored": int, "memories": [...]}
        """
        result = self._client.request("POST", "/api/memory/batch", {"memories": memories})
        return result["data"]

    def batch_delete(self, ids: list[str]) -> dict:
        """Delete multiple memories by IDs (max 100). Free operation.

        Returns:
            {"deleted": int, "ids": [...]}
        """
        result = self._client.request("DELETE", "/api/memory/batch", {"ids": ids})
        return result["data"]

    def summarize(self, limit: int = 20, query: Optional[str] = None) -> dict:
        """Summarize recent memories via LLM. Costs 5 credits.

        Returns:
            {"summary": str, "memory_count": int}
        """
        body = {"limit": limit}
        if query:
            body["query"] = query
        result = self._client.request("POST", "/api/memory/summarize", body)
        return result["data"]

    def share(
        self, memory_id: str, tenant_id: str, permission: str = "read"
    ) -> None:
        """Share a memory with another tenant."""
        self._client.request(
            "POST",
            f"/api/memory/{memory_id}/share",
            {"tenant_id": tenant_id, "permission": permission},
        )

    def shared_with_me(self) -> list[dict]:
        """List memories shared with this tenant by other agents."""
        result = self._client.request("GET", "/api/shared-with-me")
        return result["data"]
