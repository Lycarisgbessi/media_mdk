// =====================================================================
// GET    /api/videos/[id] — détail (id OU youtubeId) + vidéos liées
// PUT    /api/videos/[id] — mise à jour (staff vidéo)
// DELETE /api/videos/[id] — suppression logique (staff vidéo)
// =====================================================================

import { z } from 'zod'
import type { Prisma, Video } from '@prisma/client'
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
  publishedFilter,
  VIDEO_INCLUDE,
  VIDEO_ROLES,
  CONTENT_STATUSES,
  zDateIn,
} from '../../_lib/media-helpers'
import { promoteScheduledContent } from '../../_lib/helpers'

export const dynamic = 'force-dynamic'

const VIDEO_TYPES = ['reportage', 'replay', 'extrait'] as const

const updateSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(250).optional(),
  youtubeUrl: z.string().min(1, 'URL YouTube requise').optional(),
  description: z.string().nullish(),
  categoryId: z.string().nullish(),
  type: z.enum(VIDEO_TYPES).optional(),
  articleId: z.string().nullish(),
  status: z.enum(CONTENT_STATUSES).optional(),
  scheduledAt: zDateIn,
  publishedAt: zDateIn,
  transcription: z.string().nullish(),
  metaTitle: z.string().nullish(),
  metaDescription: z.string().nullish(),
  seoScore: z.number().int().min(0).max(100).optional(),
  duration: z.number().int().min(0).nullish(),
  thumbnailUrl: z.string().nullish(),
})

/** Retrouve une vidéo par id OU youtubeId (non supprimée). */
async function findVideo(key: string) {
  return db.video.findFirst({
    where: { OR: [{ id: key }, { youtubeId: key }], deletedAt: null },
    include: VIDEO_INCLUDE,
  })
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawKey } = await ctx.params
  const key = decodeURIComponent(rawKey)
  const user = await getOptionalUser()

  // Garantit la publication des vidéos programmées dont la date est atteinte
  if (!user) await promoteScheduledContent()

  const found = await findVideo(key)
  if (!found) return apiError('Vidéo introuvable', 404)

  const now = new Date()
  const isPublished = found.status === 'published' && !!found.publishedAt && found.publishedAt <= now
  if (!isPublished && !user) return apiError('Vidéo introuvable', 404)

  // NB : comptage des vues fait une seule fois côté client via POST /api/view
  const video: Video = found

  // Vidéos liées : priorité à la même rubrique, complétées par les plus récentes
  const relatedWhere = { deletedAt: null, ...publishedFilter() }
  let related: Video[] = []
  if (video.categoryId) {
    related = await db.video.findMany({
      where: { ...relatedWhere, categoryId: video.categoryId, id: { not: video.id } },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 4,
      include: VIDEO_INCLUDE,
    })
  }
  if (related.length < 4) {
    const excludeIds = [video.id, ...related.map((r) => r.id)]
    const extra = await db.video.findMany({
      where: { ...relatedWhere, id: { notIn: excludeIds } },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 4 - related.length,
      include: VIDEO_INCLUDE,
    })
    related = [...related, ...extra]
  }

  return jsonOk({ video, related })
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(VIDEO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id: rawKey } = await ctx.params
  const key = decodeURIComponent(rawKey)
  const existing = await db.video.findFirst({
    where: { OR: [{ id: key }, { youtubeId: key }], deletedAt: null },
  })
  if (!existing) return apiError('Vidéo introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(updateSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  if (data.categoryId) {
    const category = await db.category.findFirst({ where: { id: data.categoryId, deletedAt: null }, select: { id: true } })
    if (!category) return apiError('Rubrique introuvable', 400)
  }
  if (data.articleId) {
    const article = await db.article.findFirst({ where: { id: data.articleId, deletedAt: null }, select: { id: true } })
    if (!article) return apiError('Article lié introuvable', 400)
  }

  const patch: Prisma.VideoUncheckedUpdateInput = {}

  if (data.title !== undefined) patch.title = data.title
  if (data.description !== undefined) patch.description = data.description
  if (data.categoryId !== undefined) patch.categoryId = data.categoryId
  if (data.articleId !== undefined) patch.articleId = data.articleId
  if (data.type !== undefined) patch.type = data.type
  if (data.transcription !== undefined) patch.transcription = data.transcription
  if (data.metaTitle !== undefined) patch.metaTitle = data.metaTitle
  if (data.metaDescription !== undefined) patch.metaDescription = data.metaDescription
  if (data.seoScore !== undefined) patch.seoScore = data.seoScore
  if (data.duration !== undefined) patch.duration = data.duration
  if (data.scheduledAt !== undefined) patch.scheduledAt = data.scheduledAt

  if (data.youtubeUrl !== undefined) {
    const youtubeId = parseYouTubeId(data.youtubeUrl)
    if (!youtubeId) return apiError('URL YouTube invalide', 400)
    patch.youtubeUrl = data.youtubeUrl
    patch.youtubeId = youtubeId
    // vignette régénérée si elle n'est pas fournie explicitement
    if (data.thumbnailUrl === undefined) patch.thumbnailUrl = youtubeThumbnail(youtubeId)
  }
  if (data.thumbnailUrl !== undefined) patch.thumbnailUrl = data.thumbnailUrl

  if (data.status !== undefined) {
    patch.status = data.status
    if (data.status === 'published' && data.publishedAt === undefined && !existing.publishedAt) {
      patch.publishedAt = new Date()
    }
  }
  if (data.publishedAt !== undefined) patch.publishedAt = data.publishedAt

  const video = await db.video.update({ where: { id: existing.id }, data: patch, include: VIDEO_INCLUDE })

  await logAudit(user, 'update', 'video', video.id, { title: video.title, status: video.status })
  return jsonOk({ video })
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(VIDEO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id: rawKey } = await ctx.params
  const key = decodeURIComponent(rawKey)
  const existing = await db.video.findFirst({
    where: { OR: [{ id: key }, { youtubeId: key }], deletedAt: null },
    select: { id: true, title: true },
  })
  if (!existing) return apiError('Vidéo introuvable', 404)

  await db.video.update({ where: { id: existing.id }, data: { deletedAt: new Date() } })
  await logAudit(user, 'delete', 'video', existing.id, { title: existing.title })
  return jsonOk({ ok: true })
}
