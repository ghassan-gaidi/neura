export function FAQSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is Neura?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Neura is an external brain API for AI agents. It provides persistent memory, semantic search, and key-value state via simple HTTP calls — so agents remember facts between sessions and across context windows.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does semantic search work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'When you store a memory, Neura auto-embeds the content using OpenAI text-embedding-3-small (1536 dimensions). Searches embed your query text and return results ranked by cosine similarity, with scores from 0 to 1.',
        },
      },
      {
        '@type': 'Question',
        name: 'How much does Neura cost?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: '$1 USDC on Base buys 1000 credits. Store a memory costs 1 credit, semantic search costs 1 credit, advanced search costs 2 credits. List, delete, and state operations are free. New agents get 1000 free credits automatically.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can agents pay automatically?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Neura implements the x402 payment protocol. When an agent runs out of credits, the API returns a 402 with payment details. The agent sends USDC to the configured wallet on Base and calls the verify endpoint — credits are added atomically. No human intervention needed.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do I need to install an SDK?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Neura is a plain HTTP API. Any agent that can make HTTP requests can use it. Official SDKs are available for TypeScript (npm install neura-api) and Python (pip install neura-api), but neither is required.',
        },
      },
      {
        '@type': 'Question',
        name: 'What happens if a request fails?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Neura returns structured JSON errors with a machine-readable code and action field. For example, 429 includes a retry_after value. Use the Idempotency-Key header on POST/PATCH requests to safely retry without duplicate writes.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Neura open source?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. The source code is available on GitHub at github.com/ghassan-gaidi/neura under the MIT license. The stack is Next.js 16, Supabase pgvector (HNSW indexing), OpenAI embeddings, and Vercel deployment.',
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}