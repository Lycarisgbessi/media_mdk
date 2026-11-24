// =====================================================================
// GET  /api/comments — liste des commentaires
//      • public  : ?contentType=&contentId= → approuvés uniquement (arbre)
//      • staff   : ?all=1 (&status=) → tous, avec le contenu lié
// POST /api/comments — dépôt public (pending, rate limit 5/min/IP)
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import {
  apiError,
  jsonOk,
  readJson,
  parseWith,
  getOptionalUser,
  checkRate,
  clientIpHash,
  stripPrivate,
} from '../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const COMMENT_STATUSES = ['pending', 'approved', 'rejected', 'spam'] as const
const CONTENT_TYPES = ['article', 'audio', 'video'] as const
type ContentType = (typeof CONTENT_TYPES)[number]

const createSchema = z.object({
  contentType: z.enum(CONTENT_TYPES),
  contentId: z.string().min(1, 'Contenu requis'),
  authorName: z.string().min(2, 'Nom trop court (2 caractères minimum)').max(60, 'Nom trop long (60 caractères maximum)'),
  authorEmail: z.string().email('Email invalide').max(200),
  content: z.string().min(3, 'Message trop court (3 caractères minimum)').max(2000, 'Message trop long (2000 caractères maximum)'),
  parentId: z.string().nullish(),
})

const CONTENT_FIELD: Record<ContentType, 'articleId' | 'audioId' | 'videoId'> = {
  article: 'articleId',
  audio: 'audioId',
  video: 'videoId',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const user = await getOptionalUser()

  // ---- Vue staff : tous les commentaires (modération) ----
  if (searchParams.get('all') === '1') {
    if (!user) return apiError('Non authentifié', 401)
    const status = searchParams.get('status')
    const where: Record<string, unknown> = {}
    if (status && (COMMENT_STATUSES as readonly string[]).includes(status)) where.status = status

    const comments = await db.comment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        article: { select: { title: true, slug: true } },
        audio: { select: { title: true, slug: true } },
        video: { select: { title: true, id: true } },
      },
    })
    return jsonOk({ comments: comments.map(stripPrivate) })
  }

  // ---- Vue publique : commentaires approuvés d'un contenu, en arbre ----
  const contentType = searchParams.get('contentType') as ContentType | null
  const contentId = searchParams.get('contentId')
  if (!contentType || !contentId || !(CONTENT_TYPES as readonly string[]).includes(contentType)) {
    return jsonOk({ comments: [] })
  }

  const contentWhere =
    contentType === 'article'
      ? { articleId: contentId, status: 'approved' }
      : contentType === 'audio'
        ? { audioId: contentId, status: 'approved' }
        : { videoId: contentId, status: 'approved' }

  const rows = await db.comment.findMany({
    where: contentWhere,
    orderBy: { createdAt: 'asc' },
    take: 500,
  })

  // construction de l'arbre (réponses imbriquées)
  type CommentNode = (typeof rows)[number] & { replies: CommentNode[] }
  const byId = new Map<string, CommentNode>()
  for (const row of rows) {
    byId.set(row.id, { ...row, replies: [] })
  }
  const roots: CommentNode[] = []
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : null
    if (parent) parent.replies.push(node)
    else roots.push(node)
  }
  // discussions les plus récentes d'abord, réponses dans l'ordre chronologique
  roots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  for (const root of roots) root.replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  return jsonOk({ comments: roots.map(stripPrivate) })
}

export async function POST(request: Request) {
  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(createSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  // Rate limit : max 5 messages/minute par IP (hachée)
  const ipHash = clientIpHash(request)
  if (!checkRate(`comment:${ipHash}`, 5, 60_000)) {
    return apiError('Trop de messages, patientez', 429)
  }

  // vérification du contenu cible
  const field = CONTENT_FIELD[data.contentType]
  if (data.contentType === 'article') {
    const article = await db.article.findFirst({
      where: { id: data.contentId, deletedAt: null },
      select: { id: true, commentsOpen: true },
    })
    if (!article) return apiError('Article introuvable', 404)
    if (!article.commentsOpen) return apiError('Les commentaires sont fermés sur cet article', 403)
  } else if (data.contentType === 'audio') {
    const audio = await db.audioContent.findFirst({ where: { id: data.contentId, deletedAt: null }, select: { id: true } })
    if (!audio) return apiError('Contenu audio introuvable', 404)
  } else {
    const video = await db.video.findFirst({ where: { id: data.contentId, deletedAt: null }, select: { id: true } })
    if (!video) return apiError('Vidéo introuvable', 404)
  }

  // vérification du parent (réponse) — profondeur limitée à 2 niveaux (§6.1)
  if (data.parentId) {
    const parent = await db.comment.findUnique({ where: { id: data.parentId } })
    if (!parent) return apiError('Commentaire parent introuvable', 400)
    if (parent[field] !== data.contentId) return apiError('Commentaire parent invalide', 400)
    if (parent.parentId) {
      return apiError('Les réponses ne peuvent s\u2019imbriquer que sur deux niveaux', 400)
    }
  }

  const base = {
    parentId: data.parentId ?? null,
    authorName: data.authorName.trim(),
    authorEmail: data.authorEmail.toLowerCase().trim(),
    content: data.content.trim(),
    status: 'pending',
    ipHash,
  }
  const createData =
    data.contentType === 'article'
      ? { ...base, articleId: data.contentId }
      : data.contentType === 'audio'
        ? { ...base, audioId: data.contentId }
        : { ...base, videoId: data.contentId }

  const comment = await db.comment.create({ data: createData })

  return jsonOk({ comment: stripPrivate(comment) }, 201)
}
