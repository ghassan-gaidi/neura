"""Neura — External Brain for AI Agents.

Gives AI agents persistent memory and state via a simple HTTP API.
"""

from .client import HttpClient, NeuraHttpError
from .memory import MemoryAPI
from .state import StateAPI


class Neura:
    """Main Neura client.

    Args:
        api_key: Your API key (sk-...)
        base_url: API base URL (default: https://neura.sh)
        max_retries: Max retries on failure (default: 3)
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://neura.sh",
        max_retries: int = 3,
    ):
        self._client = HttpClient(base_url, api_key, max_retries)
        self.memory = MemoryAPI(self._client)
        self.state = StateAPI(self._client)


__all__ = ["Neura", "NeuraHttpError"]
