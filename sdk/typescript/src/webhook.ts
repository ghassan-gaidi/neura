// ============================================================
// Neura SDK — Webhook Operations
// ============================================================

import { HttpClient } from './client'
import type { Webhook, CreateWebhookInput } from './types'

export class WebhookAPI {
  constructor(private client: HttpClient) {}

  /** Register a webhook for event notifications. */
  async create(input: CreateWebhookInput): Promise<Webhook> {
    const { data } = await this.client.request<Webhook>('POST', '/api/webhooks', input)
    return data
  }

  /** List all registered webhooks. */
  async list(): Promise<Webhook[]> {
    const { data } = await this.client.request<Webhook[]>('GET', '/api/webhooks')
    return data
  }

  /** Get webhook details by ID. */
  async get(id: string): Promise<Webhook> {
    const { data } = await this.client.request<Webhook>('GET', `/api/webhooks/${id}`)
    return data
  }

  /** Update a webhook. */
  async update(id: string, input: Partial<CreateWebhookInput>): Promise<Webhook> {
    const { data } = await this.client.request<Webhook>('PATCH', `/api/webhooks/${id}`, input)
    return data
  }

  /** Delete a webhook. */
  async delete(id: string): Promise<void> {
    await this.client.request('DELETE', `/api/webhooks/${id}`)
  }

  /** Trigger retry of all failed webhook deliveries due for retry. */
  async retryFailed(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const { data } = await this.client.request<{ processed: number; succeeded: number; failed: number }>(
      'POST', '/api/webhooks/retry'
    )
    return data
  }
}
