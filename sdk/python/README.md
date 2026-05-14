# Neura Python SDK

External brain for AI agents — persistent memory and state via HTTP.

```python
from neura import Neura

neura = Neura(api_key="sk-...")

# Store a memory
neura.memory.create(content="User prefers dark mode", tags=["preference"])

# Semantic search
results = neura.memory.search("What are my preferences?")

# Persistent state
neura.state.set("current_goal", {"task": "Build the API"})
goal = neura.state.get("current_goal")
```

## Install

```bash
pip install neura-api
```

## Usage

### Memory

```python
# Create
mem = neura.memory.create(
    content="The user likes brutalist design",
    tags=["preference", "ui"],
    importance=8,
    metadata={"source": "conversation"},
)

# Semantic search
results = neura.memory.search("design preferences")

# Advanced search with filters
filtered = neura.memory.search_advanced(
    query="user settings",
    filters={"tags": ["preference"], "importance_min": 5},
    limit=20,
)

# Update
neura.memory.update(mem["id"], importance=9)

# Delete
neura.memory.delete(mem["id"])
```

### State

```python
# Set
neura.state.set("risk_level", "conservative")

# Get
risk = neura.state.get("risk_level")
# {"key": "risk_level", "value": "conservative", ...}

# List all
all_state = neura.state.list()

# Delete
neura.state.delete("risk_level")
```

### Error Handling

```python
from neura import NeuraHttpError

try:
    neura.memory.search("something")
except NeuraHttpError as e:
    print(e.code)         # 'rate_limited', 'not_found', etc.
    print(e.message)      # Human-readable
    print(e.action)       # 'wait_and_retry', 'check_api_key', etc.
    print(e.retry_after)  # Seconds to wait
```

### Retries

The SDK automatically retries on network errors and rate limits with exponential backoff.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `memory.create()` | `POST /api/memory` | Store with auto-embedding |
| `memory.search()` | `GET /api/memory?query=` | Semantic search |
| `memory.search_advanced()` | `POST /api/memory/search` | Filtered search |
| `memory.update()` | `PATCH /api/memory/:id` | Update fields |
| `memory.delete()` | `DELETE /api/memory/:id` | Remove memory |
| `state.set()` | `POST /api/state` | Upsert key-value |
| `state.get()` | `GET /api/state/:key` | Get value by key |
| `state.list()` | `GET /api/state` | List all keys |
| `state.delete()` | `DELETE /api/state/:key` | Remove key |
