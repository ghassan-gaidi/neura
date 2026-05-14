/**
 * Webhook delivery system.
 * Fires webhooks asynchronously for important events.
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
      webhooks.map((wh) => deliverWebhook(wh.id, tenantId, wh.url, wh.secret, payload))
    )
  } catch (err) {
    console.error('fireWebhook error:', err)
  }
}

async function deliverWebhook(
  webhookId: string,
  tenantId: string,
  url: string,
  secret: string | null,
  payload: WebhookPayload
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

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    })

    // Log delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhookId,
      tenant_id: tenantId,
      event: payload.event,
      payload,
      status: response.ok ? 'delivered' : 'failed',
      status_code: response.status,
      response_body: await response.text().catch(() => ''),
    }).then()
  } catch (err: any) {
    // Log failure
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhookId,
      tenant_id: tenantId,
      event: payload.event,
      payload,
      status: 'failed',
      response_body: err.message,
    }).then()
  }
}
