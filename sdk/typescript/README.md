# Neura TypeScript SDK

External brain for AI agents — persistent memory and state via HTTP.

```ts
import { Neura } from 'neura-api'

const neura = new Neura({ apiKey: 'sk-...' })

// Store a memory
await neura.memory.create({ content: 'User prefers dark mode in all apps', tags: ['preference'] })

// Semantic search
const results = await neura.memory.search('What UI preferences do I have?')

// Persistent state
await neura.state.set('current_goal', { task: 'Build the API', priority: 'high' })
const goal = await neura.state.get('current_goal')
```

## Install

```bash
npm install neura-api
```

## Usage

### Memory

```ts
// Create
const mem = await neura.memory.create({
  content: 'The user likes brutalist design with zero radius',
  tags: ['preference', 'ui'],
  importance: 8,
  metadata: { source: 'conversation' },
})

// Semantic search
const results = await neura.memory.search('design preferences')
// results[0].score  — cosine similarity 0-1

// Advanced search
const filtered = await neura.memory.searchAdvanced({
  query: 'user settings',
  filters: { tags: ['preference'], importance_min: 5 },
  limit: 20,
})

// Update
await neura.memory.update(mem.id, { importance: 9 })

// Delete
await neura.memory.delete(mem.id)
```

### State

```ts
// Set
await neura.state.set('risk_level', 'conservative')

// Get
const risk = await neura.state.get('risk_level')
// { key: 'risk_level', value: 'conservative', created_at: '...', updated_at: '...' }

// List all
const allState = await neura.state.list()

// Delete
await neura.state.delete('risk_level')
```

### Error Handling

```ts
import { NeuraHttpError } from 'neura-api'

try {
  await neura.memory.search('something')
} catch (err) {
  if (err instanceof NeuraHttpError) {
    console.log(err.code)       // 'rate_limited', 'not_found', etc.
    console.log(err.message)    // Human-readable description
    console.log(err.action)     // 'wait_and_retry', 'check_api_key', etc.
    console.log(err.retryAfter) // Seconds to wait (rate limiting)
    console.log(err.status)     // HTTP status code
  }
}
```

### Autonomous Payments

When credits run out, the API returns 402 with x402 payment details.
The SDK can handle this automatically so agents stay self-sufficient.

**Callback mode** (zero dependencies — you handle the USDC send):

```ts
const neura = new Neura({
  apiKey: 'sk-...',
  autoPay: {
    onPaymentRequired: async (x402) => {
      // x402.amount, x402.recipient, x402.chain
      const txHash = await myWallet.sendUSDC(x402.recipient, x402.amount)
      return txHash
    },
  },
})
```

**Private key mode** (SDK sends USDC — requires ethers v6):

```ts
const neura = new Neura({
  apiKey: 'sk-...',
  autoPay: {
    privateKey: '0x...',      // Base wallet private key
    rpcUrl: 'https://mainnet.base.org',
  },
})
```

When a 402 is received, the SDK:  
1. Sends the required USDC via the configured method  
2. Waits for 2 on-chain confirmations  
3. Calls `/api/payments/verify` to redeem credits  
4. Retries the original request seamlessly

### Retries

The SDK automatically retries on network errors and rate limits (429) with exponential backoff. Configure via `maxRetries`:

```ts
const neura = new Neura({
  apiKey: 'sk-...',
  maxRetries: 5, // default: 3
})
```

### Idempotency

Write operations accept an idempotency key for safe retries:

```ts
await neura.memory.create({ content: 'Important fact' }, 'my-unique-key-123')
```

## Agent Framework Examples

### LangGraph

```ts
import { Neura } from 'neura-api'

// Use as a tool in your LangGraph agent
const tools = [
  new DynamicStructuredTool({
    name: 'remember',
    description: 'Store a fact in long-term memory',
    schema: z.object({ content: z.string() }),
    func: async ({ content }) => {
      const neura = new Neura({ apiKey: process.env.NEURA_API_KEY! })
      await neura.memory.create({ content })
      return 'Stored.'
    },
  }),
]
```

### CrewAI

```python
from neura import Neura
# (Python SDK — see sdk/python/)
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `memory.create()` | `POST /api/memory` | Store with auto-embedding |
| `memory.search()` | `GET /api/memory?query=` | Semantic search |
| `memory.searchAdvanced()` | `POST /api/memory/search` | Filtered search |
| `memory.update()` | `PATCH /api/memory/:id` | Update fields |
| `memory.delete()` | `DELETE /api/memory/:id` | Remove memory |
| `state.set()` | `POST /api/state` | Upsert key-value |
| `state.get()` | `GET /api/state/:key` | Get value by key |
| `state.list()` | `GET /api/state` | List all keys |
| `state.delete()` | `DELETE /api/state/:key` | Remove key |
