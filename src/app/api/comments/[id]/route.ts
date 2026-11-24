// =====================================================================
// PATCH  /api/comments/[id] — modération d'un commentaire (staff modération)
// DELETE /api/comments/[id] — suppression (réponses supprimées d'abord)
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import {
  apiError,
  jsonOk,
  readJson,
  parseWith,
  requireStaff,
  stripPrivate,
  checkRate,
  clientIpHash,
  MODERATION_ROLES,
} from '../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'spam']),
})

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(MODERATION_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.comment.findUnique({ where: { id } })
  if (!existing) return apiError('Commentaire introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(patchSchema, body)
  if (parsed.error) return parsed.error

  const comment = await db.comment.update({
    where: { id: existing.id },
    data: { status: parsed.data.status },
  })

  await logAudit(user, 'moderate', 'comment', comment.id, {
    avant: existing.status,
    apres: comment.status,
    extrait: comment.content.slice(0, 80),
  })
  return jsonOk({ comment: stripPrivate(comment) })
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(MODERATION_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.comment.findUnique({ where: { id } })
  if (!existing) return apiError('Commentaire introuvable', 404)

  // supprimer les réponses avant le commentaire parent
  await db.$transaction([
    db.comment.deleteMany({ where: { parentId: existing.id } }),
    db.comment.delete({ where: { id: existing.id } }),
  ])

  await logAudit(user, 'delete', 'comment', existing.id, { extrait: existing.content.slice(0, 80) })
  return jsonOk({ ok: true })
}

// =====================================================================
// POST /api/comments/[id] — signalement public d'un commentaire (§6.2)
// Incrémente le compteur `reports` ; visible côté modération.
// =====================================================================
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  // max 5 signalements / minute par IP
  if (!checkRate(`report:${clientIpHash(request)}`, 5, 60_000)) {
    return apiError('Trop de signalements, patientez', 429)
  }

  const existing = await db.comment.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return apiError('Commentaire introuvable', 404)

  const comment = await db.comment.update({
    where: { id: existing.id },
    data: { reports: { increment: 1 } },
    select: { id: true, reports: true },
  })
  return jsonOk({ ok: true, reports: comment.reports })
}
