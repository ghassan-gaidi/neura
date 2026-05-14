/**
 * Neura x Vercel AI SDK — Tool Integration
 * 
 * Use Neura as a tool in Vercel AI SDK apps (Next.js, Node, etc.).
 * 
 * Install:
 *   npm install neura ai
 * 
 * Example: Next.js route handler
 */
import { Neura } from 'neura'

// Initialize once per request
function getNeura() {
  return new Neura({
    apiKey: process.env.NEURA_API_KEY!,
    // autoPay: { privateKey: process.env.AGENT_WALLET_KEY },
  })
}

/**
 * Vercel AI SDK tool definitions for Neura.
 * Drop these into your tool list.
 */
export const neuraTools = {
  neura_remember: {
    description: 'Store a fact, preference, or result in long-term memory. Semantic search later.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The fact to remember' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
        importance: { type: 'number', description: 'Importance 0-10', minimum: 0, maximum: 10 },
      },
      required: ['content'],
    },
  },
  neura_recall: {
    description: 'Search long-term memory by semantic similarity. Use natural language.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query' },
        limit: { type: 'number', description: 'Max results', default: 5 },
      },
      required: ['query'],
    },
  },
  neura_set_state: {
    description: 'Store persistent key-value state (goals, settings, progress).',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'State key' },
        value: { description: 'Any JSON value' },
      },
      required: ['key', 'value'],
    },
  },
  neura_get_state: {
    description: 'Retrieve a previously stored state value by key.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'State key' },
      },
      required: ['key'],
    },
  },
} as const

/**
 * Execute a Neura tool call from the AI SDK.
 * Usage in a route handler:
 * 
 *   const result = await neuraToolExecutor(toolCall)
 */
export async function neuraToolExecutor(toolCall: {
  toolName: string
  args: Record<string, unknown>
}) {
  const neura = getNeura()

  switch (toolCall.toolName) {
    case 'neura_remember': {
      const { content, tags, importance } = toolCall.args as any
      const mem = await neura.memory.create({ content, tags, importance })
      return `Stored: "${content}" (id: ${mem.id})`
    }
    case 'neura_recall': {
      const { query, limit } = toolCall.args as any
      const results = await neura.memory.search(query, limit || 5)
      if (!results.length) return 'No relevant memories found.'
      return results.map((r, i) =>
        `[${i + 1}] (score: ${(r.score ?? 0).toFixed(2)}, importance: ${r.importance}) ${r.content}`
      ).join('\n')
    }
    case 'neura_set_state': {
      const { key, value } = toolCall.args as any
      await neura.state.set(key, value)
      return `State "${key}" set.`
    }
    case 'neura_get_state': {
      const { key } = toolCall.args as any
      try {
        const entry = await neura.state.get(key)
        return JSON.stringify(entry.value)
      } catch {
        return `No state found for key "${key}".`
      }
    }
    default:
      throw new Error(`Unknown tool: ${toolCall.toolName}`)
  }
}

/**
 * Full route handler example:
 * 
 * import { streamText } from 'ai'
 * import { openai } from '@ai-sdk/openai'
 * 
 * export async function POST(req: Request) {
 *   const { messages } = await req.json()
 *   
 *   const result = streamText({
 *     model: openai('gpt-4o'),
 *     messages,
 *     tools: neuraTools,
 *     onStepFinish: async ({ toolCalls }) => {
 *       for (const call of toolCalls) {
 *         const output = await neuraToolExecutor(call)
 *         console.log(`Tool ${call.toolName}:`, output)
 *       }
 *     },
 *   })
 *   
 *   return result.toDataStreamResponse()
 * }
 */
