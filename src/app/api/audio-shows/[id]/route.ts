// =====================================================================
// PUT/POST /api/audio-shows/[id] — mise à jour d'une émission (staff audio)
// DELETE   /api/audio-shows/[id] — suppression (409 si contenus liés)
// =====================================================================

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { apiError, jsonOk, readJson, parseWith, requireStaff, uniqueShowSlug, AUDIO_ROLES } from '../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(150).optional(),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().nullish(),
  coverImageUrl: z.string().nullish(),
  hostNames: z.string().nullish(),
  categoryId: z.string().nullish(),
  driveFolderUrl: z.string().nullish(),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
})

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(AUDIO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.audioShow.findFirst({ where: { id, deletedAt: null } })
  if (!existing) return apiError('Émission introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(updateSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  if (data.categoryId) {
    const category = await db.category.findFirst({ where: { id: data.categoryId, deletedAt: null }, select: { id: true } })
    if (!category) return apiError('Rubrique introuvable', 400)
  }

  const patch: Prisma.AudioShowUncheckedUpdateInput = {}

  if (data.name !== undefined) patch.name = data.name
  if (data.slug !== undefined) patch.slug = await uniqueShowSlug(data.slug, existing.id)
  if (data.description !== undefined) patch.description = data.description
  if (data.coverImageUrl !== undefined) patch.coverImageUrl = data.coverImageUrl
  if (data.hostNames !== undefined) patch.hostNames = data.hostNames
  if (data.categoryId !== undefined) patch.categoryId = data.categoryId
  if (data.driveFolderUrl !== undefined) patch.driveFolderUrl = data.driveFolderUrl
  if (data.order !== undefined) patch.order = data.order
  if (data.active !== undefined) patch.active = data.active

  const show = await db.audioShow.update({
    where: { id: existing.id },
    data: patch,
    include: { schedule: true, _count: { select: { contents: true } } },
  })

  await logAudit(user, 'update', 'audio_show', show.id, { name: show.name })
  return jsonOk({ show })
}

// Alias POST → PUT (contrat : « POST/PUT via [id] »)
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return PUT(request, ctx)
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(AUDIO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.audioShow.findFirst({ where: { id, deletedAt: null }, select: { id: true, name: true } })
  if (!existing) return apiError('Émission introuvable', 404)

  const contentsCount = await db.audioContent.count({ where: { showId: existing.id, deletedAt: null } })
  if (contentsCount > 0) {
    return apiError('Impossible de supprimer : des contenus audio sont liés à cette émission', 409)
  }

  await db.audioShow.delete({ where: { id: existing.id } }) // grille (schedule) supprimée en cascade
  await logAudit(user, 'delete', 'audio_show', existing.id, { name: existing.name })
  return jsonOk({ ok: true })
}
