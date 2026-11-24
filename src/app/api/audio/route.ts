// =====================================================================
// GET  /api/audio — liste des contenus audio (public + filtres)
// POST /api/audio — création d'un contenu audio (staff audio)
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
  getPagination,
  statusFilterFor,
  uniqueAudioSlug,
  AUDIO_INCLUDE,
  AUDIO_ROLES,
  CONTENT_STATUSES,
  zDateIn,
} from '../_lib/media-helpers'
import { promoteScheduledContent } from '../_lib/helpers'

export const dynamic = 'force-dynamic'

const AUDIO_TYPES = ['podcast', 'chronique', 'reportage_audio', 'episode'] as const

const createSchema = z.object({
  type: z.enum(AUDIO_TYPES).default('podcast'),
  title: z.string().min(1, 'Titre requis').max(250),
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
  status: z.enum(CONTENT_STATUSES).default('draft'),
  scheduledAt: zDateIn,
  publishedAt: zDateIn,
  metaTitle: z.string().nullish(),
  metaDescription: z.string().nullish(),
  metaKeywords: z.string().nullish(),
  seoScore: z.number().int().min(0).max(100).optional(),
  // accepté pour compatibilité front mais non stocké (pas de table de tags audio)
  tags: z.array(z.string()).optional(),
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
  if (type && (AUDIO_TYPES as readonly string[]).includes(type)) where.type = type

  const showSlug = searchParams.get('show')
  if (showSlug) {
    const show = await db.audioShow.findFirst({
      where: { slug: showSlug, deletedAt: null },
      select: { id: true },
    })
    if (!show) return jsonOk({ audio: [], total: 0, page, pages: 0 })
    where.showId = show.id
  }

  const categorySlug = searchParams.get('category')
  if (categorySlug) {
    const category = await db.category.findFirst({
      where: { slug: categorySlug, deletedAt: null },
      select: { id: true },
    })
    if (!category) return jsonOk({ audio: [], total: 0, page, pages: 0 })
    where.categoryId = category.id
  }

  const author = searchParams.get('author')
  if (author) where.authorId = author

  const search = searchParams.get('search')
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { transcription: { contains: search, mode: 'insensitive' } },
    ]
  }

  const orderBy: Prisma.AudioContentOrderByWithRelationInput[] =
    searchParams.get('order') === 'views'
      ? [{ views: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }]
      : [{ publishedAt: 'desc' }, { createdAt: 'desc' }]

  const [items, total] = await Promise.all([
    db.audioContent.findMany({ where, include: AUDIO_INCLUDE, orderBy, skip, take: limit }),
    db.audioContent.count({ where }),
  ])

  return jsonOk({ audio: items, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(request: Request) {
  const guard = await requireStaff(AUDIO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(createSchema, body)
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

  let publishedAt: Date | null = data.publishedAt ?? null
  if (data.status === 'published' && !publishedAt) publishedAt = new Date()

  const slug = await uniqueAudioSlug(data.title)

  const audio = await db.audioContent.create({
    data: {
      type: data.type,
      title: data.title,
      slug,
      description: data.description ?? null,
      categoryId: data.categoryId ?? null,
      showId: data.showId ?? null,
      googleDriveUrl: data.googleDriveUrl ?? null,
      googleDriveFileId: data.googleDriveFileId ?? null,
      duration: data.duration ?? 0,
      coverImageUrl: data.coverImageUrl ?? null,
      season: data.season ?? null,
      episodeNumber: data.episodeNumber ?? null,
      transcription: data.transcription ?? null,
      status: data.status,
      publishedAt,
      scheduledAt: data.scheduledAt ?? null,
      metaTitle: data.metaTitle ?? null,
      metaDescription: data.metaDescription ?? null,
      metaKeywords: data.metaKeywords ?? null,
      seoScore: data.seoScore ?? 0,
      authorId: user.id,
    },
    include: AUDIO_INCLUDE,
  })

  await logAudit(user, 'create', 'audio_content', audio.id, { title: audio.title, status: audio.status })
  return jsonOk({ audio }, 201)
}
