// =====================================================================
// /api/articles
// GET  : liste paginée (public = publiés uniquement ; staff = filtres)
// POST : création (staff — le journaliste est toujours l'auteur)
// =====================================================================

import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit, requireRole } from '@/lib/auth'
import { readingTimeFromText } from '@/lib/helpers'
import {
  ARTICLE_STATUSES,
  ROLES_ARTICLES,
  allowedStatusForRole,
  apiError,
  articleInclude,
  badRequest,
  forbidden,
  getMinSeoScore,
  ok,
  parseIds,
  promoteScheduledContent,
  publishedFilter,
  serializeArticle,
  syncArticleTags,
  uniqueSlug,
} from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------
// GET — liste avec filtres : status, category, author, tag, featured,
// search, page, limit, order, exclude, ids
// ---------------------------------------------------------------------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const session = await requireRole(ROLES_ARTICLES)
  const staff = !!session
  const now = new Date()

  // Garantit la publication des contenus programmés dont la date est atteinte
  if (!staff) await promoteScheduledContent()
  // Statut : public = publiés uniquement ; staff = statut demandé ou tout
  const status = searchParams.get('status') || 'published'
  let statusFilter: Prisma.ArticleWhereInput
  if (staff) {
    if (status === 'all') {
      statusFilter = {}
    } else if ((ARTICLE_STATUSES as readonly string[]).includes(status)) {
      statusFilter = status === 'published' ? publishedFilter(now) : { status }
    } else {
      return badRequest('Statut invalide')
    }
  } else {
    statusFilter = publishedFilter(now)
  }

  const where: Prisma.ArticleWhereInput = { deletedAt: null, ...statusFilter }

  const category = searchParams.get('category')
  if (category) where.category = { slug: category, deletedAt: null }

  const author = searchParams.get('author')
  if (author) where.authorId = author

  const tag = searchParams.get('tag')
  if (tag) where.tags = { some: { tag: { slug: tag } } }

  const search = searchParams.get('search')
  if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { lede: { contains: search, mode: 'insensitive' } }]

  const exclude = parseIds(searchParams.get('exclude'))
  const ids = parseIds(searchParams.get('ids'))
  if (exclude.length || ids.length) {
    where.id = {
      ...(exclude.length ? { notIn: exclude } : {}),
      ...(ids.length ? { in: ids } : {}),
    }
  }

  const featured = searchParams.get('featured') === '1'
  if (featured) where.isFeatured = true

  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(Math.max(1, Number.parseInt(searchParams.get('limit') || '12', 10) || 12), 50)

  const order = searchParams.get('order') || 'recent'
  let orderBy: Prisma.ArticleOrderByWithRelationInput[]
  if (featured) orderBy = [{ featuredRank: 'asc' }, { publishedAt: 'desc' }]
  else if (order === 'views') orderBy = [{ views: 'desc' }, { publishedAt: 'desc' }]
  else orderBy = [{ publishedAt: 'desc' }, { createdAt: 'desc' }]

  const [total, rows] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({
      where,
      include: articleInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return ok({ articles: rows.map(serializeArticle), total, page, pages: Math.ceil(total / limit) })
}

// ---------------------------------------------------------------------
// POST — création d'article (admin, rédacteur en chef, journaliste)
// ---------------------------------------------------------------------
const createSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  slug: z.string().optional(),
  type: z.string().optional(),
  subtitle: z.string().nullish(),
  lede: z.string().nullish(),
  content: z.string().optional(),
  coverImageUrl: z.string().nullish(),
  coverCaption: z.string().nullish(),
  coverCredit: z.string().nullish(),
  categoryId: z.string().nullish(),
  authorId: z.string().nullish(),
  status: z.enum(ARTICLE_STATUSES).optional(),
  publishedAt: z.unknown().optional(),
  scheduledAt: z.unknown().optional(),
  isFeatured: z.boolean().optional(),
  featuredRank: z.number().int().nullish(),
  commentsOpen: z.boolean().optional(),
  readingTime: z.number().int().optional(),
  metaTitle: z.string().nullish(),
  metaDescription: z.string().nullish(),
  metaKeywords: z.string().nullish(),
  ogImageUrl: z.string().nullish(),
  fontId: z.string().nullish(),
  language: z.string().optional(),
  seoScore: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
})

export async function POST(req: Request) {
  const user = await requireRole(ROLES_ARTICLES)
  if (!user) return forbidden('Réservé à la rédaction')

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Données invalides : un titre est requis au minimum')
  const data = parsed.data

  // Workflow éditorial côté serveur : un journaliste ne peut pas publier seul (§7)
  const allowedStatuses = allowedStatusForRole(user.role)
  const status = data.status && allowedStatuses.includes(data.status) ? data.status : 'draft'
  const isFeatured = user.role === 'journalist' ? false : (data.isFeatured ?? false)
  const featuredRank = user.role === 'journalist' ? null : (data.featuredRank ?? null)

  // Journaliste : auteur obligatoirement lui-même
  let authorId = data.authorId ?? null
  if (user.role === 'journalist') authorId = user.id
  if (authorId) {
    const author = await db.user.findFirst({ where: { id: authorId, deletedAt: null } })
    if (!author) return badRequest('Auteur introuvable')
  }
  if (data.categoryId) {
    const category = await db.category.findFirst({ where: { id: data.categoryId, deletedAt: null } })
    if (!category) return badRequest('Rubrique introuvable')
  }

  const publishedAt =
    status === 'published' ? (toNullableDate(data.publishedAt) ?? new Date()) : toNullableDate(data.publishedAt)

  // Seuil SEO éditorial (§13) : publication bloquée si score < minimum requis
  if (status === 'published') {
    const min = await getMinSeoScore()
    if (min > 0 && (data.seoScore ?? 0) < min) {
      return apiError(`Score SEO insuffisant (${data.seoScore ?? 0}/100, minimum requis : ${min})`, 422, {
        seoScore: data.seoScore ?? 0,
        min,
      })
    }
  }

  const slug = await uniqueSlug(data.slug || data.title, (s) =>
    db.article.findUnique({ where: { slug: s } }).then((r) => !!r)
  )

  const created = await db.article.create({
    data: {
      type: data.type ?? 'article',
      title: data.title,
      subtitle: data.subtitle ?? null,
      slug,
      lede: data.lede ?? null,
      content: data.content ?? '',
      coverImageUrl: data.coverImageUrl ?? null,
      coverCaption: data.coverCaption ?? null,
      coverCredit: data.coverCredit ?? null,
      categoryId: data.categoryId ?? null,
      authorId,
      status,
      publishedAt,
      scheduledAt: toNullableDate(data.scheduledAt),
      isFeatured,
      featuredRank,
      commentsOpen: data.commentsOpen ?? true,
      readingTime: data.readingTime ?? readingTimeFromText(data.content ?? ''),
      metaTitle: data.metaTitle ?? null,
      metaDescription: data.metaDescription ?? null,
      metaKeywords: data.metaKeywords ?? null,
      ogImageUrl: data.ogImageUrl ?? null,
      fontId: data.fontId ?? null,
      seoScore: data.seoScore ?? 0,
      language: data.language ?? 'fr',
    },
    include: articleInclude,
  })

  if (data.tags?.length) await syncArticleTags(created.id, data.tags)
  await logAudit(user, 'article.create', 'article', created.id, { title: created.title })

  const article = await db.article.findUnique({ where: { id: created.id }, include: articleInclude })
  return ok({ article: article ? serializeArticle(article) : serializeArticle(created) }, 201)
}

// Convertit une valeur de date du corps JSON (chaîne ISO) en Date ou null
function toNullableDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
