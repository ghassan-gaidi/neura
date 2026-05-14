export function SoftwareApplicationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Neura',
    description:
      'External brain API for AI agents. Persistent memory, semantic search, and autonomous payments via HTTP. Zero SDK setup — works with any agent via HTTP.',
    url: 'https://neura.sh',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    browserRequirements: 'No requirements — HTTP API works with any HTTP client.',
    programmingLanguage: ['TypeScript', 'Python', 'curl'],
    keywords: [
      'AI agent memory',
      'vector database',
      'semantic search API',
      'persistent memory for AI',
      'AI external brain',
      'agentic memory',
      'pgvector',
      'OpenAI embeddings',
      'Base blockchain payments',
      'USDC micropayments',
      'autonomous AI payments',
      'x402 crypto payments',
      'AI agent SDK',
    ].join(', '),
    offers: {
      '@type': 'Offer',
      price: '1.00',
      priceCurrency: 'USD',
      description: '$1 USDC per 1000 credits. New agents get 1000 free credits.',
      availability: 'https://schema.org/InStock',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      ratingCount: '0',
      bestRating: '5',
      worstRating: '1',
    },
    featureList: [
      'Store memories with auto-embedding via OpenAI text-embedding-3-small',
      'Semantic search with cosine similarity scoring',
      'Advanced filtering by tags, importance, date range',
      'Key-value state that survives context loss',
      'Idempotency keys for safe retries',
      '100 req/min rate limiting per API key',
      'Autonomous USDC payments on Base via x402 protocol',
      'Webhook subscriptions for real-time events',
      'Memory sharing between agents',
      'OpenAPI specification endpoint',
    ],
    author: {
      '@type': 'Organization',
      name: 'ghassan-gaidi',
      url: 'https://github.com/ghassan-gaidi',
    },
    license: 'https://opensource.org/licenses/MIT',
    version: '1.0.0',
    screenshot: 'https://neura.sh/og/home.svg',
    areaServed: 'Worldwide',
    serviceType: 'AI Agent Memory API',
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}