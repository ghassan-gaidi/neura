# Neura Launch Posts — Ready to Publish

---

## X/Twitter Thread

Post this as a thread (4 tweets):

**1/4**
I built Neura — an HTTP API that gives AI agents persistent memory.
No SDK required (but we have one). No setup. Just curl.
→ neura-blond.vercel.app

**2/4**
How it works:
POST /api/memory → store facts (auto-embedded via Voyage AI)
GET /api/memory?query=... → semantic search
POST /api/state → key-value state
Webhooks, sharing, batch ops, TTL cleanup.
28 endpoints, one API key.

**3/4**
Built for agents that need to remember between sessions:
• Agent context persistence
• Multi-agent shared memory
• Research agent notebooks
• Autonomous bot state management
1000 free credits to start. $1 for another 1000 via USDC on Base.

**4/4**
Stack: Next.js 16 + Supabase/pgvector + Voyage AI voyage-4
SDKs: neura-api on npm and PyPI
Payments: x402 protocol via Base USDC (direct RPC, no API key needed)
MIT open source → github.com/ghassan-gaidi/neura
Docs → neura-blond.vercel.app/docs

---

## Show HN

**Title:** Neura – External brain for AI agents

**URL:** https://neura-blond.vercel.app

**Text:**

I built Neura because every time I spin up an agent, it starts with zero context. No memory of previous runs, no preferences, no state.

Neura is a simple HTTP API that gives agents persistent memory:

```
POST /api/memory     → store a fact (auto-embedded)
GET /api/memory?query= → semantic search
POST /api/state      → key-value state
```

Agents just send HTTP requests. No SDK required (though we ship both TypeScript and Python SDKs).

**28 endpoints** covering:
- Memory CRUD + semantic search (pgvector HNSW, cosine similarity)
- Batch operations (up to 25 memories per call)
- Key-value state
- Webhooks with exponential backoff retry
- Cross-tenant memory sharing
- Memory TTL cleanup
- Usage analytics

**Payments:** New agents get 1000 free credits. When they run out, the API returns HTTP 402 with x402 payment details. The agent sends USDC on Base, retries, and keeps going. No human in the loop.

**Stack:** Next.js 16 on Vercel, Supabase + pgvector, Voyage AI voyage-4 embeddings (200M free tokens, no CC), Base USDC via direct RPC.

MIT → github.com/ghassan-gaidi/neura
npm/pip → neura-api

---

## Reddit (r/MachineLearning, r/LocalLLaMA)

**Title:** I built an HTTP API that gives AI agents persistent memory + webhooks + payments

**Text:**

Every agent I've built has the same problem: it starts fresh every time. No memory of previous conversations, no persistent state, no way to pay for continued usage.

I built Neura to solve this. It's a simple API:

Storage → POST /api/memory with content → auto-embedded
Recall → GET /api/memory?query="user preferences" → semantic search
State → POST /api/state { key, value } → persists between sessions

The interesting part is the payment model. Each agent gets 1000 free credits. When they run out, the API returns HTTP 402 with a crypto payment request (x402 protocol). The agent pays 1 USDC for 1000 more credits via Base chain, and continues autonomously. No dashboard, no billing portal, no human.

**28 endpoints, 2 SDKs (npm + PyPI), MIT license.**

Architecture details in the comments if anyone wants the technical deep-dive on pgvector HNSW indexes, the credit deduction with row-level locking, or the webhook retry system.

https://neura-blond.vercel.app

---

## Dev.to Article (Outline)

**Title:** Building an external brain for AI agents

**Content outline:**

1. **The Problem:** Agents are stateless by nature. Every new session is amnesia.
2. **The Solution:** A simple HTTP API for persistent memory + state.
3. **Quick Start:** 4 lines of code, zero setup.
4. **Architecture:** Next.js 16 + Supabase/pgvector + Voyage AI embeddings
5. **The x402 Payment Protocol:** How agents pay for themselves with USDC
6. **Webhooks & Events:** Event-driven agent workflows
7. **SDK Examples:** TypeScript and Python
8. **Open Source:** Full MIT, contributions welcome

Write this as a full tutorial post on dev.to — sign up at dev.to and publish under your account.
