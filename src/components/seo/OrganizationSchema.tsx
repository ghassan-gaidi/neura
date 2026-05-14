export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Neura',
    description:
      'Open-source external brain API for AI agents. Persistent memory and state via HTTP, built with Next.js, Supabase pgvector, and OpenAI.',
    url: 'https://neura.sh',
    logo: {
      '@type': 'ImageObject',
      url: 'https://neura.sh/favicon.svg',
    },
    image: 'https://neura.sh/og/home.svg',
    sameAs: ['https://github.com/ghassan-gaidi/neura'],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'ghassan@neura.sh',
      contactType: 'technical support',
      availableLanguage: 'English',
    },
    foundingDate: '2026',
    areaServed: 'Worldwide',
    serviceType: 'AI Agent Memory API',
    knowsAbout: [
      'AI agent memory systems',
      'vector semantic search',
      'pgvector HNSW indexing',
      'OpenAI text embeddings',
      'Base blockchain payments',
      'autonomous AI payments',
      'x402 payment protocol',
      'idempotent HTTP APIs',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Neura API Credits',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Store Memory',
            description: 'Store a fact with auto-embedding',
          },
          price: '0.001',
          priceCurrency: 'USD',
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Semantic Search',
            description: 'Natural language memory search',
          },
          price: '0.001',
          priceCurrency: 'USD',
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Advanced Search',
            description: 'Filtered search with metadata and date range',
          },
          price: '0.002',
          priceCurrency: 'USD',
        },
      ],
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}