// ============================================================
// Neura SDK — Admin Operations
// ============================================================

import { HttpClient } from './client'
import type { ApiKeyMeta, ApiKeyCreateResult, Transaction, UsageStats } from './types'

export class AdminAPI {
  constructor(private client: HttpClient) {}

  /** List all API keys for this tenant. */
  async listKeys(): Promise<ApiKeyMeta[]> {
    const { data } = await this.client.request<ApiKeyMeta[]>('GET', '/api/admin/keys')
    return data
  }

  /** Create a new API key. Returns the raw key once. */
  async createKey(label?: string): Promise<ApiKeyCreateResult> {
    const { data } = await this.client.request<ApiKeyCreateResult>('POST', '/api/admin/keys', { label })
    return data
  }

  /** Revoke (deactivate) an API key by ID. */
  async revokeKey(id: string): Promise<void> {
    await this.client.request('DELETE', `/api/admin/keys/${id}`)
  }

  /** List credit transaction history. */
  async listTransactions(limit = 20): Promise<Transaction[]> {
    const { data } = await this.client.request<Transaction[]>('GET', `/api/admin/transactions?limit=${limit}`)
    return data
  }

  /** Get usage statistics. */
  async getUsage(days = 7): Promise<UsageStats> {
    const { data } = await this.client.request<UsageStats>('GET', `/api/admin/usage?days=${days}`)
    return data
  }
}

/** Credits operations */
export class CreditsAPI {
  constructor(private client: HttpClient) {}

  /** Get current credit balance and pricing info. */
  async balance(): Promise<{ balance: number; pricing: Record<string, number> }> {
    const { data } = await this.client.request<{ balance: number; pricing: Record<string, number> }>(
      'GET', '/api/credits'
    )
    return data
  }
}
