export function APIReferenceSchema() {
  // Describe the API as a whole using Schema.org's WebAPI type
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'APIReference',
    name: 'Neura Memory API',
    description:
      'HTTP API for AI agent memory. Store facts with auto-embedding, search by semantic similarity, manage key-value state. Supports idempotency keys and autonomous x402 crypto payments.',
    url: 'https://neura.sh/docs',
    documentation: 'https://neura.sh/docs',
    provider: {
      '@type': 'Organization',
      name: 'Neura',
      url: 'https://neura.sh',
    },
    programmingLanguage: {
      '@type': 'ComputerLanguage',
      name: 'HTTP',
      url: 'https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol',
    },
    license: 'https://opensource.org/licenses/MIT',
    version: 'v1',
    endpoint: [
      {
        '@type': 'WebAPIEndpoint',
        description: 'Store a memory with auto-embedding via OpenAI',
        method: 'POST',
        url: 'https://neura.sh/api/memory',
      },
      {
        '@type': 'WebAPIEndpoint',
        description: 'Semantic search across memories by natural language query',
        method: 'GET',
        url: 'https://neura.sh/api/memory?query={query}&limit={limit}',
      },
      {
        '@type': 'WebAPIEndpoint',
        description: 'Advanced search with filters (tags, importance, date range)',
        method: 'POST',
        url: 'https://neura.sh/api/memory/search',
      },
      {
        '@type': 'WebAPIEndpoint',
        description: 'Update a memory by ID',
        method: 'PATCH',
        url: 'https://neura.sh/api/memory/{id}',
      },
      {
        '@type': 'WebAPIEndpoint',
        description: 'Delete a memory by ID',
        method: 'DELETE',
        url: 'https://neura.sh/api/memory/{id}',
      },
      {
        '@type': 'WebAPIEndpoint',
        description: 'Set a key-value state entry',
        method: 'POST',
        url: 'https://neura.sh/api/state',
      },
      {
        '@type': 'WebAPIEndpoint',
        description: 'Get all state entries',
        method: 'GET',
        url: 'https://neura.sh/api/state',
      },
      {
        '@type': 'WebAPIEndpoint',
        description: 'Get a specific state value',
        method: 'GET',
        url: 'https://neura.sh/api/state/{key}',
      },
      {
        '@type': 'WebAPIEndpoint',
        description: 'Delete a state entry',
        method: 'DELETE',
        url: 'https://neura.sh/api/state/{key}',
      },
      {
        '@type': 'WebAPIEndpoint',
        description: 'Get remaining credits balance',
        method: 'GET',
        url: 'https://neura.sh/api/credits',
      },
      {
        '@type': 'WebAPIEndpoint',
        description: 'Verify on-chain USDC payment and credit account atomically',
        method: 'POST',
        url: 'https://neura.sh/api/payments/verify',
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