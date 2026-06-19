# 🧠 Neura — External Brain for AI Agents

> **Give your AI agents persistent memory, state, and autonomous payments — without building infrastructure.**

[![npm](https://img.shields.io/badge/npm-neura--api%400.2.0-blue)](https://www.npmjs.com/package/neura-api)
[![PyPI](https://img.shields.io/badge/pypi-neura--api--python%400.1.0-blue)](https://pypi.org/project/neura-api-python/)
[![Deploy](https://img.shields.io/badge/vercel-neura--blond.vercel.app-black)](https://neura-blond.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000)](https://nextjs.org/)

---

## 🎯 What It Does

Neura is a **managed HTTP API** that gives AI agents (LangGraph, CrewAI, AutoGPT, custom agents) three superpowers:

1. **🧠 Persistent Memory** — Store facts with automatic vector embeddings. Search by semantic meaning, not keywords.
2. **📦 Key-Value State** — Cross-session state storage for long-running agent workflows.
3. **💰 Autonomous Crypto Payments** — Agents pay their own way via USDC on Base chain (x402 protocol). No credit card needed.

---

## 🔥 Why It's Different

| Feature | Neura | DIY Vector DB | Other AI Memory APIs |
|---------|-------|---------------|---------------------|
| **Auto-embedding** | Built-in (OpenAI text-embedding-3-small) | You build it | Usually included |
| **Crypto-native billing** | USDC on Base (agent pays itself) | ❌ | ❌ |
| **HTTP 402 auto-payment** | SDK handles it transparently | ❌ | ❌ |
| **Webhook events** | 7 event types | You build it | Limited |
| **Cross-tenant sharing** | Shared memories between agents | ❌ | ❌ |
| **SDKs** | TypeScript + Python | ❌ | Usually 1 SDK |

---

## ⚡ Quick Start

```typescript
import { NeuraClient } from 'neura-api';

const client = new NeuraClient({ apiKey: 'your-key' });

// Store a memory (auto-embedded)
await client.memory.create('The user prefers dark mode in all interfaces');

// Semantic search (no keywords needed)
const results = await client.memory.search('UI preferences');

// Store cross-session state
await client.state.set('user_theme', 'dark');
```

```python
from neura_api import NeuraClient

client = NeuraClient(api_key='your-key')

# Same API, Pythonic
client.memory.store("The user's favorite color is #000000")
results = client.memory.search("design preferences")
```

---

## 🏗️ Architecture

```
┌──────────────────────────────┐
│         Your Agent           │
│  (LangGraph / CrewAI / etc)  │
└──────────┬───────────────────┘
           │ HTTPS
           ▼
┌──────────────────────────────┐
│      Neura API (Next.js)     │
│  ┌────────┐ ┌──────────────┐ │
│  │ Memory │ │ State Store  │ │
│  │ (vec)  │ │  (key-value) │ │
│  ├────────┤ ├──────────────┤ │
│  │Webhook │ │ Credits/Pay  │ │
│  │ System │ │  (USDC/Base) │ │
│  └────────┘ └──────────────┘ │
└──────────┬───────────────────┘
           │
    ┌──────┴──────┐
    │  Supabase   │
    │ (pgvector)  │
    │ 10 tables   │
    │ 3 RPCs      │
    └─────────────┘
```

---

## 🛣️ API Surface (20 Endpoints)

### Memory (Core)
| Method | Endpoint | Cost | Description |
|--------|----------|------|-------------|
| `POST` | `/api/memory` | 1 credit | Store with auto-embedding (OpenAI, 1536d). Idempotent. |
| `GET` | `/api/memory` | 0-1 | List recent or semantic search |
| `POST` | `/api/memory/search` | 2 | Advanced: tags, importance, date range, metadata |
| `PATCH` | `/api/memory/:id` | 1 | Update — re-embeds if content changes |
| `DELETE` | `/api/memory/:id` | Free | Delete with webhook |
| `POST` | `/api/memory/summarize` | 5 | Extractive/abstractive summarization (GPT-4o-mini) |

### Sharing
- Share memories across agents with read/write permissions
- Cross-tenant collaboration without exposing raw data

### State (Free)
- Upsert/get/delete key-value pairs across sessions
- Perfect for agent workflow state, user preferences, checkpoint data

### Webhooks (Free)
- 7 event types: `memory.created`, `.updated`, `.deleted`, `.expiring`, `state.changed`, `memory.shared`, `credits.low`
- HMAC-SHA256 signed delivery
- Delivery logging with 10s timeout

### Payments
- 1000 free credits on signup
- $1 USDC = 1000 credits (Base chain)
- HTTP 402 → auto-payment → retry (SDKs handle this transparently)
- Cron polls Base chain for uncredited transfers (`*/5 * * * *`)

---

## 🛠️ Tech Stack

| Layer | Choice |
|-------|--------|
| **Runtime** | Next.js 16 (App Router) — TypeScript 5 |
| **Vector DB** | Supabase + pgvector (HNSW index, 1536d cosine) |
| **Embeddings** | OpenAI `text-embedding-3-small` |
| **Auth** | Supabase Auth (magic link) + SHA-256 API keys |
| **Payments** | Base blockchain USDC (direct RPC — no third-party) |
| **Rate Limiting** | In-memory sliding window (100 req/60s) |
| **SDKs** | TypeScript (`neura-api@0.2.0`) + Python (`neura-api-python@0.1.0`) |
| **Deploy** | Vercel — `neura-blond.vercel.app` |

---

## 📦 What's Published

- **npm:** `neura-api@0.2.0` — Full TypeScript SDK with auto-payment retry
- **PyPI:** `neura-api-python@0.1.0` — Python SDK, same capabilities
- **API Docs:** Full OpenAPI spec at `/docs/api`

---

## 📊 Status

- **Phase:** 5/9 complete (self-serve signup live, API key dashboard next)
- **Commits:** 22+ on `main`
- **Cron:** `*/5 * * * *` polls on-chain payments
- **Blocker:** Supabase project paused (needs resume for schema migration)

---

## 🧠 Skills Demonstrated

`TypeScript` `Next.js 16` `Supabase/pgvector` `OpenAI Embeddings` `Base Chain USDC` `x402 Protocol` `SDK Authoring (npm + PyPI)` `Rate Limiting` `Webhook Systems` `Idempotency` `Multi-tenant Architecture`

> *An AI agent API with autonomous crypto payments — because agents should pay their own way.*
