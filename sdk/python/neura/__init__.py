"""
Neura — External Brain for AI Agents
=====================================

Gives AI agents persistent memory and state via a simple HTTP API.

Usage:
    from neura import Neura

    neura = Neura(api_key="sk-...")

    # Store a memory
    neura.memory.create(content="User prefers dark mode", tags=["preference"])

    # Semantic search
    results = neura.memory.search("What are my preferences?")

    # Persistent state
    neura.state.set("current_goal", {"task": "Build the API"})
    goal = neura.state.get("current_goal")
"""

__version__ = "0.1.0"

from .neura import Neura
from .client import NeuraHttpError

__all__ = ["Neura", "NeuraHttpError"]
