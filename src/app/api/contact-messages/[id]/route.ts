// =====================================================================
// PATCH  /api/contact-messages/[id] — statut + note interne (staff modération)
// DELETE /api/contact-messages/[id] — suppression
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { apiError, jsonOk, readJson, parseWith, requireStaff, MODERATION_ROLES } from '../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  status: z.enum(['new', 'read', 'answered', 'archived']).optional(),
  note: z.string().max(2000).nullish(),
})

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(MODERATION_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.contactMessage.findUnique({ where: { id } })
  if (!existing) return apiError('Message introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(patchSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  const patch: { status?: string; note?: string | null } = {}
  if (data.status !== undefined) patch.status = data.status
  if (data.note !== undefined) patch.note = data.note

  const message = await db.contactMessage.update({ where: { id: existing.id }, data: patch })

  await logAudit(user, 'update', 'contact_message', message.id, {
    sujet: message.subject,
    statut: message.status,
  })
  return jsonOk({ message })
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(MODERATION_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.contactMessage.findUnique({ where: { id }, select: { id: true, subject: true } })
  if (!existing) return apiError('Message introuvable', 404)

  await db.contactMessage.delete({ where: { id: existing.id } })
  await logAudit(user, 'delete', 'contact_message', existing.id, { sujet: existing.subject })
  return jsonOk({ ok: true })
}
