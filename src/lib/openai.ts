/**
 * OpenAI embeddings client.
 * Default: text-embedding-3-small (1536 dimensions, fast + cheap).
 * Override via OPENAI_EMBEDDING_MODEL and OPENAI_API_KEY env vars.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS || '1536', 10)

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI embedding error (${response.status}): ${errorBody}`)
  }

  const result = await response.json()
  return result.data[0].embedding
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * Much more efficient for batch operations.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI batch embedding error (${response.status}): ${errorBody}`)
  }

  const result = await response.json()
  return result.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding)
}
