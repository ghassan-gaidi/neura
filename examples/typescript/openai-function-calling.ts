/**
 * OpenAI Function Calling — Neura Tool Definitions
 * 
 * Drop these into any OpenAI-compatible API call.
 * Works with: OpenAI, Anthropic, Groq, Together, any OpenAI-compatible endpoint.
 * 
 * Usage:
 *   const response = await openai.chat.completions.create({
 *     model: "gpt-4o",
 *     messages: [...],
 *     tools: neuraOpenAITools,
 *     tool_choice: "auto",
 *   })
 */

export const neuraOpenAITools = [
  {
    type: 'function',
    function: {
      name: 'neura_remember',
      description: 'Store a fact, preference, or result in long-term memory. Later semantic search.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The fact or information to remember',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorization (e.g. ["preference", "user"])',
          },
          importance: {
            type: 'number',
            description: 'Importance level 0-10 (default 0)',
            minimum: 0,
            maximum: 10,
          },
        },
        required: ['content'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'neura_recall',
      description: 'Search long-term memory by semantic similarity using natural language.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language description of what to find',
          },
          limit: {
            type: 'number',
            description: 'Maximum results to return (default 5, max 50)',
            default: 5,
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'neura_set_state',
      description: 'Persist a key-value state entry that survives across conversations.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'State key (e.g. "current_goal", "risk_level")',
          },
          value: {
            description: 'Any JSON-serializable value to store',
          },
        },
        required: ['key', 'value'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'neura_get_state',
      description: 'Retrieve a previously stored state value by its key.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'The state key to look up',
          },
        },
        required: ['key'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'neura_list_state',
      description: 'List all stored state keys and their values.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'neura_delete_state',
      description: 'Delete a state entry by key.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'The state key to delete',
          },
        },
        required: ['key'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    type: 'function',
    function: {
      name: 'neura_summarize',
      description: 'Summarize a set of related memories into a concise overview.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language query describing what to summarize',
          },
          limit: {
            type: 'number',
            description: 'Max memories to include (default 20, max 100)',
            default: 20,
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
] as const
