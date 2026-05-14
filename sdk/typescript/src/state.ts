// ============================================================
// Neura SDK — State Operations
// ============================================================

import { HttpClient } from './client'
import type { StateEntry } from './types'

export class StateAPI {
  constructor(private client: HttpClient) {}

  /**
   * Set a key-value state entry.
   * Overwrites any existing value for the same key.
   * 
   * @example
   * await neura.state.set('current_goal', { task: 'Build API', priority: 'high' })
   */
  async set(key: string, value: unknown, idempotencyKey?: string): Promise<StateEntry> {
    const { data } = await this.client.request<StateEntry>('POST', '/api/state', { key, value }, {
      idempotencyKey,
    })
    return data
  }

  /**
   * Get a specific state value by key.
   * Throws NeuraHttpError with code 'not_found' if key doesn't exist.
   */
  async get(key: string): Promise<StateEntry> {
    const { data } = await this.client.request<StateEntry>('GET', `/api/state/${encodeURIComponent(key)}`)
    return data
  }

  /**
   * List all state entries for this agent.
   */
  async list(): Promise<StateEntry[]> {
    const { data } = await this.client.request<StateEntry[]>('GET', '/api/state')
    return data
  }

  /**
   * Delete a state entry by key.
   */
  async delete(key: string): Promise<void> {
    await this.client.request('DELETE', `/api/state/${encodeURIComponent(key)}`)
  }
}
