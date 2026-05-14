# Neura — Framework Integration Examples

Copy-paste examples for adding Neura to your agent framework.

## LangGraph (TypeScript)

```ts
import { Neura } from 'neura'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

const neura = new Neura({ apiKey: process.env.NEURA_API_KEY! })

const tools = [
  new DynamicStructuredTool({
    name: 'remember',
    description: 'Store a fact in long-term memory',
    schema: z.object({ content: z.string() }),
    func: async ({ content }) => {
      await neura.memory.create({ content })
      return 'Stored.'
    },
  }),
]
```

Full example: [`examples/typescript/langgraph-agent.mjs`](typescript/langgraph-agent.mjs)

## CrewAI (Python)

```python
from neura import Neura
from crewai.tools import tool

neura = Neura(api_key="sk-...")

@tool("Remember")
def remember(content: str) -> str:
    neura.memory.create(content=content)
    return "Stored."
```

Full example: [`examples/python/crewai_agent.py`](python/crewai_agent.py)

## Vercel AI SDK (TypeScript)

Drop-in tool definitions + executor for Vercel AI SDK apps.

```ts
import { neuraTools, neuraToolExecutor } from './vercel-ai-sdk'

const result = streamText({
  model: openai('gpt-4o'),
  messages,
  tools: neuraTools,
})
```

Full example: [`examples/typescript/vercel-ai-sdk.ts`](typescript/vercel-ai-sdk.ts)

## OpenAI Function Calling

Drop-in `tools` array for any OpenAI-compatible API.

```ts
import { neuraOpenAITools } from './openai-function-calling'

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  tools: neuraOpenAITools,
})
```

Full example: [`examples/typescript/openai-function-calling.ts`](typescript/openai-function-calling.ts)

## Autonomous Payments

All examples work with autoPay. When credits run out, the SDK sends USDC automatically:

```ts
const neura = new Neura({
  apiKey: 'sk-...',
  autoPay: { privateKey: '0x...' }, // Base wallet
})
```
