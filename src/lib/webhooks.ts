/**
 * Webhook delivery system.
 * Fires webhooks asynchronously for important events.
 * Failed deliveries are retried with exponential backoff.
 * In production, replace with a queue (Inngest, Bull, etc.).
 */

import { supabase } from './supabase'

export type WebhookEvent =
  | 'memory.created'
  | 'memory.updated'
  | 'memory.deleted'
  | 'memory.expiring'
  | 'state.changed'
  | 'memory.shared'
  | 'credits.low'

interface WebhookPayload {
  event: WebhookEvent
  tenant_id: string
  data: Record<string, unknown>
  timestamp: string
}

const RETRY_DELAYS = [30, 120, 600, 3600, 21600] // 30s, 2min, 10min, 1hr, 6hr
const MAX_RETRIES = RETRY_DELAYS.length

function computeNextRetry(retryCount: number): Date | null {
  if (retryCount >= MAX_RETRIES) return null // give up after max retries
  const delayMs = RETRY_DELAYS[retryCount] * 1000
  return new Date(Date.now() + delayMs)
}

/**
 * Fire a webhook event for the given tenant.
 * Finds all active webhooks subscribed to this event and delivers them.
 * Fire-and-forget — never blocks the request.
 */
export async function fireWebhook(
  tenantId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('id, url, secret')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .contains('events', [event])

    if (error || !webhooks?.length) return

    const payload: WebhookPayload = {
      event,
      tenant_id: tenantId,
      data,
      timestamp: new Date().toISOString(),
    }

    // Deliver to each webhook concurrently
    await Promise.allSettled(
      webhooks.map((wh) => deliverWebhook(wh.id, wh.url, wh.secret, payload))
    )
  } catch (err) {
    console.error('fireWebhook error:', err)
  }
}

export async function deliverWebhook(
  webhookId: string,
  url: string,
  secret: string | null,
  payload: WebhookPayload,
  existingDeliveryId?: string,
  currentRetryCount = 0,
): Promise<void> {
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Neura-Webhook/1.0',
    'X-Neura-Event': payload.event,
    'X-Neura-Timestamp': payload.timestamp,
  }

  // Add HMAC signature if secret is configured
  if (secret) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
    headers['X-Neura-Signature'] = btoa(String.fromCharCode(...new Uint8Array(signature)))
  }

  const nextRetry = computeNextRetry(currentRetryCount)
  const newRetryCount = currentRetryCount + 1

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    })

    if (existingDeliveryId) {
      // Update existing delivery record (retry)
      await supabase.from('webhook_deliveries').update({
        status: response.ok ? 'delivered' : 'failed',
        status_code: response.status,
        response_body: await response.text().catch(() => ''),
        attempted_at: new Date().toISOString(),
        next_retry_at: response.ok ? null : nextRetry?.toISOString() || null,
        retry_count: newRetryCount,
      }).eq('id', existingDeliveryId)
    } else {
      // First attempt — insert new delivery record
      await supabase.from('webhook_deliveries').insert({
        webhook_id: webhookId,
        tenant_id: payload.tenant_id,
        event: payload.event,
        payload,
        status: response.ok ? 'delivered' : 'failed',
        status_code: response.status,
        response_body: await response.text().catch(() => ''),
        attempted_at: new Date().toISOString(),
        next_retry_at: response.ok ? null : nextRetry?.toISOString() || null,
        retry_count: newRetryCount,
      })
    }
  } catch (err: any) {
    const record = {
      status: 'failed' as const,
      response_body: err.message,
      attempted_at: new Date().toISOString(),
      next_retry_at: nextRetry?.toISOString() || null,
      retry_count: newRetryCount,
    }

    if (existingDeliveryId) {
      await supabase.from('webhook_deliveries').update(record).eq('id', existingDeliveryId)
    } else {
      await supabase.from('webhook_deliveries').insert({
        webhook_id: webhookId,
        tenant_id: payload.tenant_id,
        event: payload.event,
        payload,
        ...record,
      })
    }
  }
}

/**
 * Process pending/failed webhook deliveries that are due for retry.
 * Called by Vercel cron job.
 */
export async function retryFailedDeliveries(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = new Date().toISOString()

  const { data: due, error } = await supabase
    .from('webhook_deliveries')
    .select('id, webhook_id, event, payload, retry_count')
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', now)
    .limit(50)

  if (error || !due?.length) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  let succeeded = 0
  let failed = 0

  await Promise.allSettled(
    due.map(async (delivery) => {
      // Get webhook URL
      const { data: wh } = await supabase
        .from('webhooks')
        .select('url, secret, is_active')
        .eq('id', delivery.webhook_id)
        .single()

      if (!wh || !wh.is_active) {
        // Webhook was deleted or deactivated — mark as cancelled
        await supabase.from('webhook_deliveries').update({
          status: 'cancelled',
          next_retry_at: null,
        }).eq('id', delivery.id)
        return
      }

      const payload = delivery.payload as WebhookPayload
      await deliverWebhook(
        delivery.webhook_id,
        wh.url,
        wh.secret,
        payload,
        delivery.id,
        delivery.retry_count || 0,
      )

      // Check if it succeeded after this attempt
      const { data: updated } = await supabase
        .from('webhook_deliveries')
        .select('status')
        .eq('id', delivery.id)
        .single()

      if (updated?.status === 'delivered') succeeded++
      else failed++
    })
  )

  return { processed: due.length, succeeded, failed }
}
