// =====================================================================
// GET    /api/audio/[slug] — détail d'un contenu audio (id OU slug)
// PUT    /api/audio/[slug] — mise à jour (staff audio)
// DELETE /api/audio/[slug] — suppression logique (staff audio)
// =====================================================================

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import {
  apiError,
  jsonOk,
  readJson,
  parseWith,
  requireStaff,
  getOptionalUser,
  uniqueAudioSlug,
  publishedFilter,
  AUDIO_INCLUDE,
  AUDIO_ROLES,
  CONTENT_STATUSES,
  zDateIn,
} from '../../_lib/media-helpers'
import { promoteScheduledContent } from '../../_lib/helpers'

export const dynamic = 'force-dynamic'

const AUDIO_TYPES = ['podcast', 'chronique', 'reportage_audio', 'episode'] as const

const updateSchema = z.object({
  type: z.enum(AUDIO_TYPES).optional(),
  title: z.string().min(1, 'Titre requis').max(250).optional(),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().nullish(),
  categoryId: z.string().nullish(),
  showId: z.string().nullish(),
  googleDriveUrl: z.string().nullish(),
  googleDriveFileId: z.string().nullish(),
  duration: z.number().int().min(0).nullish(),
  coverImageUrl: z.string().nullish(),
  season: z.number().int().nullish(),
  episodeNumber: z.number().int().nullish(),
  transcription: z.string().nullish(),
  status: z.enum(CONTENT_STATUSES).optional(),
  scheduledAt: zDateIn,
  publishedAt: zDateIn,
  metaTitle: z.string().nullish(),
  metaDescription: z.string().nullish(),
  metaKeywords: z.string().nullish(),
  seoScore: z.number().int().min(0).max(100).optional(),
})

/** Retrouve un contenu audio par id OU slug (non supprimé). */
async function findAudio(key: string) {
  return db.audioContent.findFirst({
    where: { OR: [{ slug: key }, { id: key }], deletedAt: null },
    include: AUDIO_INCLUDE,
  })
}

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug: rawKey } = await ctx.params
  const key = decodeURIComponent(rawKey)
  const user = await getOptionalUser()

  // Garantit la publication des épisodes programmés dont la date est atteinte
  if (!user) await promoteScheduledContent()

  const found = await findAudio(key)
  if (!found) return apiError('Contenu audio introuvable', 404)

  const now = new Date()
  const isPublished = found.status === 'published' && !!found.publishedAt && found.publishedAt <= now
  if (!isPublished && !user) return apiError('Contenu audio introuvable', 404)

  const audio = found

  // NB : le comptage des vues est fait une seule fois côté client via
  // POST /api/view (déjà en place) — plus de double comptage ici.

  // Playlist : autres épisodes publiés de la même émission
  const playlist = audio.showId
    ? await db.audioContent.findMany({
        where: { showId: audio.showId, id: { not: audio.id }, deletedAt: null, ...publishedFilter() },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        include: AUDIO_INCLUDE,
      })
    : []

  return jsonOk({ audio, playlist })
}

export async function PUT(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const guard = await requireStaff(AUDIO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { slug: rawKey } = await ctx.params
  const key = decodeURIComponent(rawKey)
  const existing = await findAudio(key)
  if (!existing) return apiError('Contenu audio introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(updateSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  if (data.categoryId) {
    const category = await db.category.findFirst({ where: { id: data.categoryId, deletedAt: null }, select: { id: true } })
    if (!category) return apiError('Rubrique introuvable', 400)
  }
  if (data.showId) {
    const show = await db.audioShow.findFirst({ where: { id: data.showId, deletedAt: null }, select: { id: true } })
    if (!show) return apiError('Émission introuvable', 400)
  }

  const patch: Prisma.AudioContentUncheckedUpdateInput = {}

  if (data.title !== undefined) {
    patch.title = data.title
    patch.slug = await uniqueAudioSlug(data.title, existing.id)
  }
  if (data.slug !== undefined) patch.slug = await uniqueAudioSlug(data.slug, existing.id)
  if (data.type !== undefined) patch.type = data.type
  if (data.description !== undefined) patch.description = data.description
  if (data.categoryId !== undefined) patch.categoryId = data.categoryId
  if (data.showId !== undefined) patch.showId = data.showId
  if (data.googleDriveUrl !== undefined) patch.googleDriveUrl = data.googleDriveUrl
  if (data.googleDriveFileId !== undefined) patch.googleDriveFileId = data.googleDriveFileId
  if (data.duration !== undefined) patch.duration = data.duration ?? 0
  if (data.coverImageUrl !== undefined) patch.coverImageUrl = data.coverImageUrl
  if (data.season !== undefined) patch.season = data.season
  if (data.episodeNumber !== undefined) patch.episodeNumber = data.episodeNumber
  if (data.transcription !== undefined) patch.transcription = data.transcription
  if (data.metaTitle !== undefined) patch.metaTitle = data.metaTitle
  if (data.metaDescription !== undefined) patch.metaDescription = data.metaDescription
  if (data.metaKeywords !== undefined) patch.metaKeywords = data.metaKeywords
  if (data.seoScore !== undefined) patch.seoScore = data.seoScore
  if (data.scheduledAt !== undefined) patch.scheduledAt = data.scheduledAt

  if (data.status !== undefined) {
    patch.status = data.status
    // publication automatique : publishedAt = maintenant si vide
    if (data.status === 'published' && data.publishedAt === undefined && !existing.publishedAt) {
      patch.publishedAt = new Date()
    }
  }
  if (data.publishedAt !== undefined) patch.publishedAt = data.publishedAt

  const audio = await db.audioContent.update({ where: { id: existing.id }, data: patch, include: AUDIO_INCLUDE })

  await logAudit(user, 'update', 'audio_content', audio.id, { title: audio.title, status: audio.status })
  return jsonOk({ audio })
}

export async function DELETE(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const guard = await requireStaff(AUDIO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { slug: rawKey } = await ctx.params
  const key = decodeURIComponent(rawKey)
  const existing = await db.audioContent.findFirst({
    where: { OR: [{ slug: key }, { id: key }], deletedAt: null },
    select: { id: true, title: true },
  })
  if (!existing) return apiError('Contenu audio introuvable', 404)

  await db.audioContent.update({ where: { id: existing.id }, data: { deletedAt: new Date() } })
  await logAudit(user, 'delete', 'audio_content', existing.id, { title: existing.title })
  return jsonOk({ ok: true })
}
