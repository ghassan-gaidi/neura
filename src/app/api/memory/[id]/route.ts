import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { unauthorized, internalError, notFound, badRequest, apiError, ErrorCodes } from '@/lib/errors'
import { AuthContext } from '@/lib/types'

/**
 * DELETE /api/memory/[id]
 * Delete a specific memory by ID.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return unauthorized()

    const { id } = await params
    if (!id) return badRequest('Memory ID is required')

    const { data, error } = await supabase
      .from('memories')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select('id')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return notFound('Memory')
      }
      return apiError(ErrorCodes.INTERNAL_ERROR, 'Delete failed: ' + error.message, 500)
    }

    return NextResponse.json({ data: { id, deleted: true } })
  } catch (err: any) {
    console.error('DELETE /api/memory error:', err)
    return internalError(err.message)
  }
}

/**
 * PATCH /api/memory/[id]
 * Update a memory (content, metadata, tags, importance).
 * If content changes, a new embedding is generated.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return unauthorized()

    const { id } = await params
    if (!id) return badRequest('Memory ID is required')

    const body = await request.json().catch(() => ({}))
    if (!body.content && !body.metadata && !body.tags && body.importance === undefined) {
      return badRequest('At least one field to update is required')
    }

    const updates: Record<string, unknown> = {}
    if (body.content) updates.content = body.content
    if (body.metadata) updates.metadata = body.metadata
    if (body.tags) updates.tags = body.tags
    if (body.importance !== undefined) updates.importance = body.importance

    // If content changed, regenerate embedding
    if (body.content) {
      try {
        const { generateEmbedding } = await import('@/lib/openai')
        const embedding = await generateEmbedding(body.content)
        updates.embedding = `[${embedding.join(',')}]`
      } catch (err: any) {
        // Non-fatal — embedding will be stale but memory still updates
        console.error('Failed to regenerate embedding on update:', err.message)
      }
    }

    const { data, error } = await supabase
      .from('memories')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select('id, content, metadata, tags, importance, expires_at, created_at, updated_at')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return notFound('Memory')
      }
      return apiError(ErrorCodes.INTERNAL_ERROR, 'Update failed: ' + error.message, 500)
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('PATCH /api/memory error:', err)
    return internalError(err.message)
  }
}
