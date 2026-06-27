# 🧠 Neura — External Brain for AI Agents

> **Give your AI agents persistent memory, state, webhooks, and autonomous payments — without building infrastructure.**

[![npm](https://img.shields.io/badge/npm-neura--api%400.3.0-blue)](https://www.npmjs.com/package/neura-api)
[![PyPI](https://img.shields.io/badge/pypi-neura--api--python%400.3.0-blue)](https://pypi.org/project/neura-api-python/)
[![Deploy](https://img.shields.io/badge/vercel-neura--blond.vercel.app-black)](https://neura-blond.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 🎯 What It Does

Neura is a **managed HTTP API** that gives AI agents persistent memory, state, and autonomous payments. Drop it into any agent — LangChain, CrewAI, AutoGPT, or a custom script — with one import.

| Capability | What You Get |
|------------|-------------|
| 🧠 **Memory** | Store facts with auto-embedding (Voyage AI → Gemini fallback). Semantic search with cosine scoring. |
| 📦 **State** | Key-value storage that survives context loss. JSON-serializable. |
| 🔔 **Webhooks** | Real-time event notifications with HMAC signing and auto-retry (exponential backoff, 5 attempts). |
| 💰 **Payments** | 1,000 free credits on signup. $1 USDC per 1k credits on Base. SDK autoPay mode. |
| 🔑 **Dashboard** | API key management — list, create, revoke keys. Usage stats. Transaction history. |
| 📋 **Batch** | Create up to 25 memories or delete up to 100 in one call. |

---

## ⚡ Quick Start

```bash
npm install neura-api
```

```typescript
import { Neura } from 'neura-api'

const neura = new Neura({ apiKey: 'sk-...' })

// Store a memory (auto-embedded)
await neura.memory.create({ content: 'User prefers dark mode', tags: ['preference'] })

// Semantic search
const results = await neura.memory.search('UI preferences')

// Key-value state
await neura.state.set('current_goal', { task: 'Build API' })
const goal = await neura.state.get('current_goal')

// Batch create
await neura.memory.batchCreate([
  { content: 'Meeting notes: Q3 roadmap', tags: ['work'] },
  { content: 'Server budget under $200/mo', tags: ['ops'] },
])

// Webhooks
await neura.webhooks.create({
  url: 'https://my-agent.dev/events',
  events: ['memory.created', 'credits.low'],
})

// Admin — list and revoke keys
const keys = await neura.admin.listKeys()
await neura.admin.revokeKey(keyId)
```

```python
from neura import Neura

neura = Neura(api_key="sk-...")

neura.memory.create(content="User prefers dark mode", tags=["preference"])
results = neura.memory.search("UI preferences")
neura.state.set("current_goal", {"task": "Build API"})
```

---

## 📋 SDK Methods

### Memory

| Method | Description | Cost |
|--------|-------------|------|
| `memory.create(input)` | Store with auto-embedding | 1 credit |
| `memory.search(query, limit?)` | Semantic search | 1 credit |
| `memory.searchAdvanced(input)` | Filter by tags, date, importance | 2 credits |
| `memory.recent(limit?)` | Most recent memories | Free |
| `memory.update(id, input)` | Update fields, re-embeds if content changes | 1 credit |
| `memory.delete(id)` | Delete a memory | Free |
| `memory.batchCreate(inputs[])` | Store up to 25 at once | 1 credit each |
| `memory.batchDelete(ids[])` | Delete up to 100 at once | Free |
| `memory.summarize(limit?, query?)` | LLM summary of memories | 5 credits |
| `memory.share(id, tenantId, permission?)` | Share with another agent | Free |
| `memory.sharedWithMe()` | Memories shared with you | Free |

### State

| Method | Description |
|--------|-------------|
| `state.set(key, value)` | Upsert a key-value pair |
| `state.get(key)` | Get value by key |
| `state.list()` | List all entries |
| `state.delete(key)` | Remove an entry |

### Webhooks

| Method | Description |
|--------|-------------|
| `webhooks.create(input)` | Register a webhook URL + events |
| `webhooks.list()` | List all webhooks |
| `webhooks.get(id)` | Get webhook details |
| `webhooks.update(id, input)` | Update URL/events |
| `webhooks.delete(id)` | Remove a webhook |
| `webhooks.retryFailed()` | Retry failed deliveries |

### Admin

| Method | Description |
|--------|-------------|
| `admin.listKeys()` | List all API keys |
| `admin.createKey(label?)` | Create a new key |
| `admin.revokeKey(id)` | Deactivate a key |
| `admin.listTransactions(limit?)` | Credit transaction history |
| `admin.getUsage(days?)` | Usage statistics |

### Credits

| Method | Description |
|--------|-------------|
| `credits.balance()` | Current balance + pricing |

---

## 🏗️ Architecture

```
┌──────────────────────────────┐
│         Your Agent           │
│  (LangChain / CrewAI / etc)  │
└──────────┬───────────────────┘
           │ HTTPS (Bearer sk-...)
           ▼
┌──────────────────────────────────────┐
│       Neura API (Next.js 16)         │
│  ┌────────┐ ┌────────┐ ┌──────────┐ │
│  │ Memory │ │ State  │ │Webhooks  │ │
│  │ (vec)  │ │ (KV)   │ │ + retry  │ │
│  ├────────┤ ├────────┤ ├──────────┤ │
│  │ Admin  │ │Credits │ │ Payments │ │
│  │ (keys) │ │(USDC)  │ │ (Base)   │ │
│  └────────┘ └────────┘ └──────────┘ │
└──────────────────┬───────────────────┘
                   │
            ┌──────┴──────┐
            │  Supabase   │
            │ (pgvector)  │
            │ + Vercel KV │
            └─────────────┘
```

---

## 🛣️ API Routes (28 Endpoints)

| Group | Endpoints |
|-------|-----------|
| **Memory** | `POST/GET /api/memory`, `POST /api/memory/batch`, `DELETE /api/memory/batch`, `POST /api/memory/search`, `POST /api/memory/summarize`, `PATCH/DELETE /api/memory/[id]`, `POST /api/memory/[id]/share`, `GET /api/memory/cleanup` |
| **State** | `POST/GET /api/state`, `GET/DELETE /api/state/[key]` |
| **Webhooks** | `POST/GET /api/webhooks`, `GET/PATCH/DELETE /api/webhooks/[id]`, `POST /api/webhooks/retry` |
| **Sharing** | `GET /api/shared-with-me` |
| **Payments** | `POST /api/payments/verify`, `GET /api/payments/poll` |
| **Credits** | `GET /api/credits` |
| **Admin** | `GET/POST /api/admin/keys`, `DELETE /api/admin/keys/[id]`, `GET /api/admin/transactions`, `GET /api/admin/usage` |
| **Auth** | `GET /api/auth/me`, `POST /api/auth/create-key` |

Full OpenAPI 3.1 spec available at `https://neura.sh/openapi.yaml`.

---

## 💰 Payments & Pricing

| Operation | Cost |
|-----------|------|
| Store memory | 1 credit |
| Semantic search | 1 credit |
| Advanced search | 2 credits |
| Update memory | 1 credit |
| Summarize | 5 credits |
| Batch create (per memory) | 1 credit |
| Delete / State / Webhooks / Sharing | Free |

- **Free tier:** 1,000 credits, 100 memories max
- **Pro tier:** Unlimited. $1 USDC per 1,000 credits
- **Autopay:** SDKs handle x402 automatically — send USDC on Base, SDK retries

**Recipient wallet:** `0x29021dd5306D7b3b6608a2bc8276D33c1200C7Ef`

---

## 🛠️ Tech Stack

| Layer | Choice |
|-------|--------|
| **Runtime** | Next.js 16 (App Router) — TypeScript 5 |
| **Vector DB** | Supabase + pgvector (HNSW index, 1024d cosine) |
| **Embeddings** | Voyage AI with Gemini fallback |
| **Auth** | Supabase Auth (magic link) + SHA-256 API keys |
| **Payments** | Base blockchain USDC (direct RPC — no third-party) |
| **Rate Limiting** | In-memory sliding window (100 req/60s) + headers |
| **SDKs** | TypeScript (`neura-api@0.3.0`) + Python (`neura-api-python@0.3.0`) |
| **Deploy** | Vercel — `neura-blond.vercel.app` |

---

## 📦 Published Packages

| Package | Version | Install |
|---------|---------|---------|
| **npm** | `0.3.0` | `npm install neura-api` |
| **PyPI** | `0.3.0` | `pip install neura-api-python` |

Both SDKs support: Memory (CRUD + batch + summarize + share), State, Webhooks, Admin, Credits, and x402 auto-payment.

---

## 🚀 Getting Started

1. Go to **[neura-blond.vercel.app/signup](https://neura-blond.vercel.app/signup)**
2. Enter your email — you'll get a magic link
3. Sign in — your API key and 1,000 free credits are created automatically
4. Use the dashboard to manage keys and monitor usage

---

## 📊 Project Status

| Phase | Status |
|-------|--------|
| 1-4 | ✅ Core API, credits, payments |
| 5 | ✅ SDK publish (npm + PyPI v0.3.0) |
| 6 | ✅ Self-serve signup |
| 7 | ✅ API key dashboard |
| 8 | ✅ Webhook retry, batch ops, rate limit headers, TTL cleanup |
| 9 | ✅ OpenAPI spec, landing polish |

---

## 🧠 Skills

`TypeScript` `Python` `Next.js 16` `Supabase/pgvector` `Voyage AI` `Gemini` `Base Chain USDC` `x402 Protocol` `SDK Authoring (npm + PyPI)` `Rate Limiting` `Webhook Systems` `Exponential Backoff` `Idempotency` `Multi-tenant Architecture`

---

> *An AI agent API with autonomous crypto payments — because agents should pay their own way.*
