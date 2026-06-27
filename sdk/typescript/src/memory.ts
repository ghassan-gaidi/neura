// ============================================================
// Neura SDK — Memory Operations
// ============================================================

import { HttpClient } from './client'
import type {
  Memory, CreateMemoryInput, UpdateMemoryInput, SearchMemoryInput,
  BatchCreateResult, BatchDeleteResult, SummarizeResult,
} from './types'

export class MemoryAPI {
  constructor(private client: HttpClient) {}

  /** Store a memory with auto-embedding. */
  async create(input: CreateMemoryInput, idempotencyKey?: string): Promise<Memory> {
    const { data } = await this.client.request<Memory>('POST', '/api/memory', input, { idempotencyKey })
    return data
  }

  /** Search memories by semantic similarity. */
  async search(query: string, limit = 10): Promise<Memory[]> {
    const { data } = await this.client.request<Memory[]>(
      'GET', `/api/memory?query=${encodeURIComponent(query)}&limit=${limit}`
    )
    return data
  }

  /** Advanced search with filters (tags, date range, metadata). */
  async searchAdvanced(input: SearchMemoryInput): Promise<Memory[]> {
    const { data } = await this.client.request<Memory[]>('POST', '/api/memory/search', input)
    return data
  }

  /** Get the most recent memories. */
  async recent(limit = 10): Promise<Memory[]> {
    const { data } = await this.client.request<Memory[]>('GET', `/api/memory?limit=${limit}`)
    return data
  }

  /** Update a memory. If content changes, embedding auto-regenerates. */
  async update(id: string, input: UpdateMemoryInput): Promise<Memory> {
    const { data } = await this.client.request<Memory>('PATCH', `/api/memory/${id}`, input)
    return data
  }

  /** Delete a memory by ID. */
  async delete(id: string): Promise<void> {
    await this.client.request('DELETE', `/api/memory/${id}`)
  }

  /** Store multiple memories at once (max 25). Costs 1 credit each. */
  async batchCreate(inputs: CreateMemoryInput[]): Promise<BatchCreateResult> {
    const { data } = await this.client.request<BatchCreateResult>('POST', '/api/memory/batch', { memories: inputs })
    return data
  }

  /** Delete multiple memories by IDs (max 100). Free operation. */
  async batchDelete(ids: string[]): Promise<BatchDeleteResult> {
    const { data } = await this.client.request<BatchDeleteResult>('DELETE', '/api/memory/batch', { ids })
    return data
  }

  /** Summarize recent memories via LLM. Costs 5 credits. */
  async summarize(limit = 20, query?: string): Promise<SummarizeResult> {
    const { data } = await this.client.request<SummarizeResult>('POST', '/api/memory/summarize', { limit, query })
    return data
  }

  /** Share a memory with another tenant. */
  async share(id: string, tenantId: string, permission: 'read' | 'write' = 'read'): Promise<void> {
    await this.client.request('POST', `/api/memory/${id}/share`, { tenant_id: tenantId, permission })
  }

  /** List memories shared with this tenant by other agents. */
  async sharedWithMe(): Promise<Memory[]> {
    const { data } = await this.client.request<Memory[]>('GET', '/api/shared-with-me')
    return data
  }
}
