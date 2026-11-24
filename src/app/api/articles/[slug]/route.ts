// =====================================================================
// /api/articles/[slug] — fiche article (id OU slug)
// GET : détail public/staff + compteur de vues
// PUT : mise à jour (le journaliste ne modifie que ses articles)
// DELETE : suppression logique (admin, rédacteur en chef ou auteur)
// =====================================================================

import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser, logAudit, requireRole } from '@/lib/auth'
import { readingTimeFromText, slugify } from '@/lib/helpers'
import {
  ARTICLE_STATUSES,
  ROLES_ARTICLES,
  UUID_RE,
  allowedStatusForRole,
  apiError,
  articleInclude,
  badRequest,
  forbidden,
  getMinSeoScore,
  notFound,
  ok,
  serializeArticle,
  syncArticleTags,
  trackView,
  uniqueSlug,
  unauthorized,
} from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------
// GET — détail ; accepte un id (UUID) ou un slug
// ---------------------------------------------------------------------
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const session = await getSessionUser()
  const staff = !!session && ROLES_ARTICLES.includes(session.role)

  let article = await db.article.findFirst({
    where: UUID_RE.test(slug) ? { id: slug, deletedAt: null } : { slug, deletedAt: null },
    include: articleInclude,
  })
  // Secours : un UUID peut parfois correspondre à un slug
  if (!article && UUID_RE.test(slug)) {
    article = await db.article.findFirst({ where: { slug, deletedAt: null }, include: articleInclude })
  }
  if (!article) return notFound('Article introuvable')

  const isPublished =
    article.status === 'published' && !!article.publishedAt && article.publishedAt <= new Date()
  if (!staff && !isPublished) return notFound('Article introuvable')

  // Comptage des vues pour les contenus publiés
  if (isPublished) {
    await db.article.update({ where: { id: article.id }, data: { views: { increment: 1 } } })
    await trackView('article', article.id)
    article = { ...article, views: article.views + 1 }
  }

  return ok({ article: serializeArticle(article) })
}

// ---------------------------------------------------------------------
// PUT — mise à jour
// ---------------------------------------------------------------------
const updateSchema = z
  .object({
    title: z.string().min(1).optional(),
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
  .partial()

export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await requireRole(ROLES_ARTICLES)
  if (!user) return forbidden('Réservé à la rédaction')

  const { slug } = await ctx.params
  const existing = await db.article.findFirst({
    where: UUID_RE.test(slug) ? { id: slug, deletedAt: null } : { slug, deletedAt: null },
  })
  if (!existing) return notFound('Article introuvable')
  if (user.role === 'journalist' && existing.authorId !== user.id) {
    return forbidden('Vous ne pouvez modifier que vos propres articles')
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Données invalides')
  const data = parsed.data

  // Auteur : le journaliste reste l'auteur de ses articles
  let authorId: string | null | undefined = data.authorId
  if (data.authorId !== undefined) {
    if (user.role === 'journalist') authorId = user.id
    if (authorId) {
      const author = await db.user.findFirst({ where: { id: authorId, deletedAt: null } })
      if (!author) return badRequest('Auteur introuvable')
    }
  }
  if (data.categoryId) {
    const category = await db.category.findFirst({ where: { id: data.categoryId, deletedAt: null } })
    if (!category) return badRequest('Rubrique introuvable')
  }

  // Slug : modifié uniquement si le client a fourni un slug différent de
  // l'actuel — éditer le titre seul ne casse jamais l'URL publique (SEO §13)
  const slugExists = (s: string) =>
    db.article.findFirst({ where: { slug: s, id: { not: existing.id } } }).then((r) => !!r)
  let nextSlug: string | undefined = undefined
  if (data.slug !== undefined && slugify(data.slug) !== existing.slug) {
    nextSlug = await uniqueSlug(data.slug, slugExists)
  }

  // Workflow éditorial côté serveur (§7) : un journaliste ne peut publier seul
  const allowedStatuses = allowedStatusForRole(user.role)
  if (data.status !== undefined && !allowedStatuses.includes(data.status)) {
    if (user.role === 'journalist') {
      return forbidden('La publication et la mise à la une sont validées par la rédaction en chef')
    }
    return badRequest('Statut invalide')
  }
  const isFeatured =
    user.role === 'journalist' ? undefined : data.isFeatured
  const featuredRank =
    user.role === 'journalist' ? undefined : data.featuredRank

  // Date de publication : automatique à la première publication
  let publishedAt: Date | null | undefined = undefined
  if (data.publishedAt !== undefined) publishedAt = toNullableDate(data.publishedAt)
  const nextStatus = data.status ?? existing.status
  if (nextStatus === 'published' && publishedAt === undefined && !existing.publishedAt) {
    publishedAt = new Date()
  }

  // Seuil SEO éditorial (§13) : publication bloquée si score < minimum requis
  if (nextStatus === 'published' && existing.status !== 'published') {
    const min = await getMinSeoScore()
    const score = data.seoScore ?? existing.seoScore
    if (min > 0 && score < min) {
      return apiError(`Score SEO insuffisant (${score}/100, minimum requis : ${min})`, 422, { seoScore: score, min })
    }
  }

  // Prisma ignore les champs undefined : seuls les champs fournis sont modifiés
  const updateData: Prisma.ArticleUncheckedUpdateInput = {
    title: data.title,
    type: data.type,
    subtitle: data.subtitle,
    slug: nextSlug,
    lede: data.lede,
    content: data.content,
    coverImageUrl: data.coverImageUrl,
    coverCaption: data.coverCaption,
    coverCredit: data.coverCredit,
    categoryId: data.categoryId,
    authorId,
    status: data.status,
    publishedAt,
    scheduledAt: data.scheduledAt !== undefined ? toNullableDate(data.scheduledAt) : undefined,
    isFeatured,
    featuredRank,
    commentsOpen: data.commentsOpen,
    readingTime:
      data.readingTime ?? (data.content !== undefined ? readingTimeFromText(data.content) : undefined),
    metaTitle: data.metaTitle,
    metaDescription: data.metaDescription,
    metaKeywords: data.metaKeywords,
    ogImageUrl: data.ogImageUrl,
    fontId: data.fontId,
    seoScore: data.seoScore,
    language: data.language,
  }

  // Tags : remplacement complet si fournis (avant le fetch final pour des includes à jour)
  if (data.tags) await syncArticleTags(existing.id, data.tags, true)

  const updated = await db.article.update({
    where: { id: existing.id },
    data: updateData,
    include: articleInclude,
  })

  await logAudit(user, 'article.update', 'article', existing.id, { title: updated.title })

  return ok({ article: serializeArticle(updated) })
}

// ---------------------------------------------------------------------
// DELETE — suppression logique (admin, rédacteur en chef ou auteur)
// ---------------------------------------------------------------------
export async function DELETE(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser()
  if (!user) return unauthorized()

  const { slug } = await ctx.params
  const article = await db.article.findFirst({
    where: UUID_RE.test(slug) ? { id: slug, deletedAt: null } : { slug, deletedAt: null },
  })
  if (!article) return notFound('Article introuvable')

  const isArticleStaff = user.role === 'admin' || user.role === 'editor_in_chief'
  const allowed = isArticleStaff || (user.role === 'journalist' && article.authorId === user.id)
  if (!allowed) return forbidden('Suppression réservée à la rédaction en chef ou à l’auteur')

  await db.article.update({ where: { id: article.id }, data: { deletedAt: new Date() } })
  await logAudit(user, 'article.delete', 'article', article.id, { title: article.title })

  return ok({ ok: true })
}

// Convertit une valeur de date du corps JSON (chaîne ISO) en Date ou null
function toNullableDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
