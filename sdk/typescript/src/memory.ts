// ============================================================
// Neura SDK — Memory Operations
// ============================================================

import { HttpClient } from './client'
import type {
  Memory,
  CreateMemoryInput,
  UpdateMemoryInput,
  SearchMemoryInput,
} from './types'

export class MemoryAPI {
  constructor(private client: HttpClient) {}

  /**
   * Store a memory with auto-embedding.
   * The content is automatically embedded via OpenAI.
   */
  async create(input: CreateMemoryInput, idempotencyKey?: string): Promise<Memory> {
    const { data } = await this.client.request<Memory>('POST', '/api/memory', input, {
      idempotencyKey,
    })
    return data
  }

  /**
   * Search memories by semantic similarity.
   * Returns memories ranked by relevance score.
   * 
   * @example
   * const results = await neura.memory.search('What are my risk preferences?')
   */
  async search(query: string, limit = 10): Promise<Memory[]> {
    const { data } = await this.client.request<Memory[]>(
      'GET',
      `/api/memory?query=${encodeURIComponent(query)}&limit=${limit}`
    )
    return data
  }

  /**
   * Advanced search with filters.
   * Supports date ranges, metadata matching, and tag filtering.
   */
  async searchAdvanced(input: SearchMemoryInput): Promise<Memory[]> {
    const { data } = await this.client.request<Memory[]>('POST', '/api/memory/search', input)
    return data
  }

  /**
   * Get the most recent memories.
   */
  async recent(limit = 10): Promise<Memory[]> {
    const { data } = await this.client.request<Memory[]>('GET', `/api/memory?limit=${limit}`)
    return data
  }

  /**
   * Update a memory's content, metadata, tags, or importance.
   * If content changes, the embedding is automatically regenerated.
   */
  async update(id: string, input: UpdateMemoryInput): Promise<Memory> {
    const { data } = await this.client.request<Memory>('PATCH', `/api/memory/${id}`, input)
    return data
  }

  /**
   * Delete a memory by ID.
   */
  async delete(id: string): Promise<void> {
    await this.client.request('DELETE', `/api/memory/${id}`)
  }
}
