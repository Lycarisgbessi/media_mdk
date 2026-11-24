// =====================================================================
// GET    /api/lives/[id] — détail d'un direct
// PUT    /api/lives/[id] — mise à jour complète (staff vidéo)
// PATCH  /api/lives/[id] — changement de statut (transitions validées)
// DELETE /api/lives/[id] — suppression réelle (pas de soft delete)
// =====================================================================

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { parseYouTubeId, youtubeThumbnail } from '@/lib/helpers'
import {
  apiError,
  jsonOk,
  readJson,
  parseWith,
  requireStaff,
  getOptionalUser,
  LIVE_TRANSITIONS,
  VIDEO_ROLES,
  zDateIn,
} from '../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const putSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(250).optional(),
  youtubeUrl: z.string().min(1, 'URL YouTube requise').optional(),
  description: z.string().nullish(),
  scheduledStart: zDateIn,
  categoryId: z.string().nullish(),
  featured: z.boolean().optional(),
  thumbnailUrl: z.string().nullish(),
})

const patchSchema = z.object({
  status: z.enum(['scheduled', 'live', 'ended', 'cancelled']),
})

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getOptionalUser()

  const live = await db.liveStream.findUnique({ where: { id } })
  if (!live) return apiError('Direct introuvable', 404)
  if (live.status === 'cancelled' && !user) return apiError('Direct introuvable', 404)

  return jsonOk({ live })
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(VIDEO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.liveStream.findUnique({ where: { id } })
  if (!existing) return apiError('Direct introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(putSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  if (data.categoryId) {
    const category = await db.category.findFirst({ where: { id: data.categoryId, deletedAt: null }, select: { id: true } })
    if (!category) return apiError('Rubrique introuvable', 400)
  }

  const patch: Prisma.LiveStreamUncheckedUpdateInput = {}

  if (data.title !== undefined) patch.title = data.title
  if (data.description !== undefined) patch.description = data.description
  if (data.scheduledStart !== undefined) patch.scheduledStart = data.scheduledStart
  if (data.categoryId !== undefined) patch.categoryId = data.categoryId
  if (data.featured !== undefined) patch.featured = data.featured

  if (data.youtubeUrl !== undefined) {
    const youtubeId = parseYouTubeId(data.youtubeUrl)
    if (!youtubeId) return apiError('URL YouTube invalide', 400)
    patch.youtubeUrl = data.youtubeUrl
    patch.youtubeId = youtubeId
    if (data.thumbnailUrl === undefined) patch.thumbnailUrl = youtubeThumbnail(youtubeId)
  }
  if (data.thumbnailUrl !== undefined) patch.thumbnailUrl = data.thumbnailUrl

  const live = await db.liveStream.update({ where: { id: existing.id }, data: patch })

  await logAudit(user, 'update', 'live_stream', live.id, { title: live.title, status: live.status })
  return jsonOk({ live })
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(VIDEO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.liveStream.findUnique({ where: { id } })
  if (!existing) return apiError('Direct introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(patchSchema, body)
  if (parsed.error) return parsed.error
  const nextStatus = parsed.data.status

  // validation des transitions : scheduled → live → ended, cancelled possible
  const allowed = LIVE_TRANSITIONS[existing.status] ?? []
  if (!allowed.includes(nextStatus)) {
    return apiError(`Transition de statut invalide (${existing.status} → ${nextStatus})`, 400)
  }

  const data: Prisma.LiveStreamUncheckedUpdateInput = { status: nextStatus }
  if (nextStatus === 'live' && !existing.actualStart) data.actualStart = new Date()
  if (nextStatus === 'ended') data.actualEnd = new Date()

  const live = await db.liveStream.update({ where: { id: existing.id }, data })

  await logAudit(user, 'status_change', 'live_stream', live.id, {
    title: live.title,
    avant: existing.status,
    apres: nextStatus,
  })
  return jsonOk({ live })
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(VIDEO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.liveStream.findUnique({ where: { id }, select: { id: true, title: true } })
  if (!existing) return apiError('Direct introuvable', 404)

  await db.liveStream.delete({ where: { id: existing.id } })
  await logAudit(user, 'delete', 'live_stream', existing.id, { title: existing.title })
  return jsonOk({ ok: true })
}
