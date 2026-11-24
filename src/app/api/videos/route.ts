// =====================================================================
// GET  /api/videos — liste des vidéos TV (public + filtres)
// POST /api/videos — création (staff vidéo) — youtubeId + vignette auto
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
  getPagination,
  statusFilterFor,
  VIDEO_INCLUDE,
  VIDEO_ROLES,
  CONTENT_STATUSES,
  zDateIn,
} from '../_lib/media-helpers'
import { promoteScheduledContent } from '../_lib/helpers'

export const dynamic = 'force-dynamic'

const VIDEO_TYPES = ['reportage', 'replay', 'extrait'] as const

const createSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(250),
  youtubeUrl: z.string().min(1, 'URL YouTube requise'),
  description: z.string().nullish(),
  categoryId: z.string().nullish(),
  type: z.enum(VIDEO_TYPES).default('reportage'),
  articleId: z.string().nullish(),
  status: z.enum(CONTENT_STATUSES).default('draft'),
  scheduledAt: zDateIn,
  publishedAt: zDateIn,
  transcription: z.string().nullish(),
  metaTitle: z.string().nullish(),
  metaDescription: z.string().nullish(),
  seoScore: z.number().int().min(0).max(100).optional(),
  duration: z.number().int().min(0).nullish(),
  thumbnailUrl: z.string().nullish(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const user = await getOptionalUser()
  // Garantit la publication des contenus programmés dont la date est atteinte
  if (!user) await promoteScheduledContent()
  const { limit, page, skip } = getPagination(searchParams, 12)

  const where: Record<string, unknown> = { deletedAt: null }
  Object.assign(where, statusFilterFor(searchParams.get('status'), user !== null))

  const type = searchParams.get('type')
  if (type && (VIDEO_TYPES as readonly string[]).includes(type)) where.type = type

  const categorySlug = searchParams.get('category')
  if (categorySlug) {
    const category = await db.category.findFirst({
      where: { slug: categorySlug, deletedAt: null },
      select: { id: true },
    })
    if (!category) return jsonOk({ videos: [], total: 0, page, pages: 0 })
    where.categoryId = category.id
  }

  const author = searchParams.get('author')
  if (author) where.authorId = author

  const search = searchParams.get('search')
  if (search) {
    where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }]
  }

  const orderBy: Prisma.VideoOrderByWithRelationInput[] =
    searchParams.get('order') === 'views'
      ? [{ views: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }]
      : [{ publishedAt: 'desc' }, { createdAt: 'desc' }]

  const [items, total] = await Promise.all([
    db.video.findMany({ where, include: VIDEO_INCLUDE, orderBy, skip, take: limit }),
    db.video.count({ where }),
  ])

  return jsonOk({ videos: items, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(request: Request) {
  const guard = await requireStaff(VIDEO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(createSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  // Extraction automatique de l'identifiant YouTube
  const youtubeId = parseYouTubeId(data.youtubeUrl)
  if (!youtubeId) return apiError('URL YouTube invalide', 400)

  if (data.categoryId) {
    const category = await db.category.findFirst({ where: { id: data.categoryId, deletedAt: null }, select: { id: true } })
    if (!category) return apiError('Rubrique introuvable', 400)
  }
  if (data.articleId) {
    const article = await db.article.findFirst({ where: { id: data.articleId, deletedAt: null }, select: { id: true } })
    if (!article) return apiError('Article lié introuvable', 400)
  }

  // Vignette automatique depuis l'ID YouTube si absente
  const thumbnailUrl = data.thumbnailUrl || youtubeThumbnail(youtubeId)

  let publishedAt: Date | null = data.publishedAt ?? null
  if (data.status === 'published' && !publishedAt) publishedAt = new Date()

  const video = await db.video.create({
    data: {
      title: data.title,
      youtubeUrl: data.youtubeUrl,
      youtubeId,
      thumbnailUrl,
      duration: data.duration ?? null,
      description: data.description ?? null,
      type: data.type,
      categoryId: data.categoryId ?? null,
      articleId: data.articleId ?? null,
      status: data.status,
      publishedAt,
      scheduledAt: data.scheduledAt ?? null,
      transcription: data.transcription ?? null,
      metaTitle: data.metaTitle ?? null,
      metaDescription: data.metaDescription ?? null,
      seoScore: data.seoScore ?? 0,
      authorId: user.id,
    },
    include: VIDEO_INCLUDE,
  })

  await logAudit(user, 'create', 'video', video.id, { title: video.title, status: video.status })
  return jsonOk({ video }, 201)
}
