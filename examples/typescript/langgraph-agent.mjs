/**
 * Neura × LangGraph — Memory Tool Example
 * 
 * Give your LangGraph agent persistent memory and state.
 * 
 * Install:
 *   npm install neura @langchain/core @langchain/langgraph
 * 
 * Run:
 *   NEURA_API_KEY=sk-... node langgraph-agent.mjs
 */

import { Neura } from 'neura'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

// Initialize Neura
const neura = new Neura({
  apiKey: process.env.NEURA_API_KEY!,
  // Uncomment for autonomous payments:
  // autoPay: { privateKey: process.env.AGENT_WALLET_KEY },
})

// === Tool: Remember a fact ===
const rememberTool = new DynamicStructuredTool({
  name: 'remember',
  description: 'Store a fact, preference, or result in long-term memory. Later retrieval is semantic.',
  schema: z.object({
    content: z.string().describe('The fact or information to remember'),
    tags: z.array(z.string()).optional().describe('Tags like ["preference", "user", "task"]'),
    importance: z.number().min(0).max(10).optional().describe('Importance 0-10 (default 0)'),
  }),
  func: async ({ content, tags, importance }) => {
    const mem = await neura.memory.create({ content, tags, importance })
    return `Stored: "${content}" (id: ${mem.id})`
  },
})

// === Tool: Recall memories ===
const recallTool = new DynamicStructuredTool({
  name: 'recall',
  description: 'Search your long-term memory for relevant information. Use natural language queries.',
  schema: z.object({
    query: z.string().describe('Natural language query — what you want to remember'),
    limit: z.number().optional().describe('Max results (default 5)'),
  }),
  func: async ({ query, limit }) => {
    const results = await neura.memory.search(query, limit || 5)
    if (results.length === 0) return 'No relevant memories found.'
    return results.map((r, i) =>
      `[${i + 1}] (score: ${(r.score ?? 0).toFixed(2)}, importance: ${r.importance}) ${r.content}`
    ).join('\n')
  },
})

// === Tool: Update state ===
const setStateTool = new DynamicStructuredTool({
  name: 'set_state',
  description: 'Store persistent state like current goals, user settings, or progress flags.',
  schema: z.object({
    key: z.string().describe('State key'),
    value: z.any().describe('Any JSON value'),
  }),
  func: async ({ key, value }) => {
    await neura.state.set(key, value)
    return `State "${key}" set.`
  },
})

// === Tool: Get state ===
const getStateTool = new DynamicStructuredTool({
  name: 'get_state',
  description: 'Retrieve a previously stored state value by key.',
  schema: z.object({
    key: z.string().describe('State key to retrieve'),
  }),
  func: async ({ key }) => {
    try {
      const entry = await neura.state.get(key)
      return JSON.stringify(entry.value)
    } catch {
      return `No state found for key "${key}".`
    }
  },
})

// === Example agent ===
async function runExample() {
  console.log('Neura × LangGraph example ready.')
  console.log('')
  console.log('Available tools:')
  console.log('  remember(content, tags?, importance?) — Store a fact')
  console.log('  recall(query, limit?) — Semantic search')
  console.log('  set_state(key, value) — Save state')
  console.log('  get_state(key) — Load state')
  console.log('')
  console.log('Usage in a LangGraph agent:')
  console.log(`
import { StateGraph } from '@langchain/langgraph'

const tools = [rememberTool, recallTool, setStateTool, getStateTool]
// Add to your agent's tool list and let the LLM decide when to use them.
// The agent will naturally remember facts and recall them later.
  `)
}

runExample()
