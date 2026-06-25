/**
 * Embeddings provider — Voyage AI with Gemini fallback.
 *
 * Primary:  Voyage AI (200M free tokens lifetime, no CC needed)
 * Fallback: Google Gemini (free tier, 1,500 req/day)
 *
 * Environment variables:
 *   VOYAGE_API_KEY      — required
 *   GEMINI_API_KEY      — optional fallback
 *   EMBEDDING_MODEL     — Voyage model (default: voyage-4)
 *   EMBEDDING_DIMENSIONS — forced output dimensions (default: 1024)
 */

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const VOYAGE_MODEL = process.env.EMBEDDING_MODEL || 'voyage-4'

const EMBEDDING_DIMS = parseInt(process.env.EMBEDDING_DIMENSIONS || '1024', 10)
const VOYAGE_BASE = 'https://api.voyageai.com/v1/embeddings'
const GEMINI_BASE = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${GEMINI_API_KEY}`

const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'EmbeddingError'
  }
}

function validateEmbedding(vec: number[], provider: string) {
  if (!vec || vec.length === 0) {
    throw new EmbeddingError('Empty embedding returned', provider)
  }
}

// ---------------------------------------------------------------------------
// Voyage AI
// ---------------------------------------------------------------------------

async function voyageEmbed(texts: string[]): Promise<number[][]> {
  const response = await fetch(VOYAGE_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts.length === 1 ? texts[0] : texts,
      input_type: 'document',
      output_dimension: EMBEDDING_DIMS,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new EmbeddingError(
      `Voyage API error (${response.status}): ${body}`,
      'voyage',
    )
  }

  const result = await response.json()
  const raw = result.data as Array<{ embedding: number[]; index: number }>

  return raw
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
}

// ---------------------------------------------------------------------------
// Google Gemini
// ---------------------------------------------------------------------------

async function geminiEmbed(texts: string[]): Promise<number[][]> {
  const results: number[][] = []

  for (const text of texts) {
    const res = await fetch(GEMINI_BASE(GEMINI_EMBEDDING_MODEL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new EmbeddingError(
        `Gemini API error (${res.status}): ${body}`,
        'gemini',
      )
    }

    const data = await res.json()
    const vec = data.embedding?.values
    if (!vec) {
      throw new EmbeddingError(
        `Gemini returned no embedding: ${JSON.stringify(data)}`,
        'gemini',
      )
    }

    // Truncate or pad to match EMBEDDING_DIMS
    if (vec.length !== EMBEDDING_DIMS) {
      results.push(vec.slice(0, EMBEDDING_DIMS))
    } else {
      results.push(vec)
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Public API  (primary → fallback)
// ---------------------------------------------------------------------------

async function embedWithFallback(
  texts: string[],
): Promise<number[][]> {
  // Try Voyage first
  try {
    if (VOYAGE_API_KEY) {
      return await voyageEmbed(texts)
    }
    throw new EmbeddingError('VOYAGE_API_KEY not configured', 'voyage')
  } catch (err) {
    // If it's a config error, don't fall back — the user needs to fix it
    if (err instanceof EmbeddingError && err.provider === 'voyage') {
      const voyageErr = err as EmbeddingError
      // Only fall back on transient API errors, not config
      if (
        voyageErr.message.includes('not configured') ||
        voyageErr.message.includes('401') ||
        voyageErr.message.includes('403')
      ) {
        if (!GEMINI_API_KEY) throw err
        console.warn('Voyage unavailable (config/auth), falling back to Gemini')
        return await geminiEmbed(texts)
      }
    }

    // Any Voyage error → try Gemini
    if (GEMINI_API_KEY) {
      console.warn('Voyage embedding failed, falling back to Gemini:', err)
      try {
        return await geminiEmbed(texts)
      } catch (geminiErr) {
        throw new EmbeddingError(
          `Both providers failed. Voyage: ${err instanceof Error ? err.message : err}. Gemini: ${geminiErr instanceof Error ? geminiErr.message : geminiErr}`,
          'both',
        )
      }
    }

    // No fallback available
    throw err
  }
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export async function generateEmbedding(text: string): Promise<number[]> {
  const results = await embedWithFallback([text])
  const vec = results[0]
  validateEmbedding(vec, 'embedding')
  return vec
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const results = await embedWithFallback(texts)
  for (const vec of results) validateEmbedding(vec, 'embedding')
  return results
}
