// =====================================================================
// Helpers API — réponses standardisées, guards de rôles, slugs uniques,
// sérialisation des contenus, comptage de vues (partagé entre routes)
// =====================================================================

import { NextResponse } from 'next/server'
import type { Article, Category, Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { slugify } from '@/lib/helpers'

// ---------- Rôles ----------
export const ROLES_ARTICLES = ['admin', 'editor_in_chief', 'journalist']
export const ROLES_CONTENT = ['admin', 'editor_in_chief']
export const ROLES_ADMIN = ['admin']

export const ARTICLE_STATUSES = ['draft', 'review', 'approved', 'scheduled', 'published', 'archived'] as const

// ---------- Réponses ----------
export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function apiError(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status })
}

export const badRequest = (m = 'Requête invalide') => apiError(m, 400)
export const unauthorized = () => apiError('Authentification requise', 401)
export const forbidden = (m = 'Accès refusé') => apiError(m, 403)
export const notFound = (m = 'Ressource introuvable') => apiError(m, 404)

// ---------- Filtre "contenu publié" (statut + date passée) ----------
export function publishedFilter(now = new Date()) {
  return { status: 'published', publishedAt: { not: null, lte: now } }
}

/**
 * Publie automatiquement les contenus programmés dont la date est atteinte
 * (articles, audio, vidéos). Appelé au début des listes publiques et du
 * tableau de bord : le passage « planifié → publié » est ainsi garanti
 * sans dépendre d'un cron externe.
 */
export async function promoteScheduledContent() {
  const now = new Date()
  try {
    const due = await db.article.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: now }, deletedAt: null },
      select: { id: true, scheduledAt: true },
    })
    for (const a of due) {
      await db.article.update({
        where: { id: a.id },
        data: { status: 'published', publishedAt: a.scheduledAt ?? now },
      })
    }
    const dueAudio = await db.audioContent.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: now }, deletedAt: null },
      select: { id: true, scheduledAt: true },
    })
    for (const a of dueAudio) {
      await db.audioContent.update({
        where: { id: a.id },
        data: { status: 'published', publishedAt: a.scheduledAt ?? now },
      })
    }
    const dueVideos = await db.video.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: now }, deletedAt: null },
      select: { id: true, scheduledAt: true },
    })
    for (const v of dueVideos) {
      await db.video.update({
        where: { id: v.id },
        data: { status: 'published', publishedAt: v.scheduledAt ?? now },
      })
    }
  } catch {
    // best effort : ne jamais bloquer une lecture
  }
}

// ---------- Seuil SEO éditorial (§13) ----------
export async function getMinSeoScore(): Promise<number> {
  try {
    const row = await db.siteSetting.findUnique({ where: { key: 'seo' } })
    if (!row) return 0
    const parsed = JSON.parse(row.value) as { minSeoScore?: unknown }
    const n = Number(parsed.minSeoScore)
    return Number.isFinite(n) && n > 0 ? Math.min(100, Math.round(n)) : 0
  } catch {
    return 0
  }
}

/** Plafond de statut pour les journalistes (workflow éditorial côté serveur, §7). */
export function allowedStatusForRole(role: string): string[] {
  return role === 'journalist' ? ['draft', 'review'] : [...ARTICLE_STATUSES]
}

// ---------- Slugs uniques (suffixe -2, -3… en cas de collision) ----------
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const root = slugify(base) || 'contenu'
  let candidate = root
  let i = 1
  while (await exists(candidate)) {
    i += 1
    candidate = `${root}-${i}`
  }
  return candidate
}

// ---------- Articles : includes + sérialisation ----------
export const articleInclude = {
  category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
  author: {
    select: { id: true, firstName: true, lastName: true, role: true, bio: true, avatarUrl: true },
  },
  tags: { include: { tag: true } },
} as const satisfies Prisma.ArticleInclude

type ArticleRow = Article & {
  category: { id: string; name: string; slug: string; color: string; icon: string | null } | null
  author: { id: string; firstName: string; lastName: string; role: string; bio: string | null; avatarUrl: string | null } | null
  tags: { tag: { id: string; name: string; slug: string } }[]
}

export function serializeArticle(a: ArticleRow) {
  const { tags, ...rest } = a
  return { ...rest, tags: tags.map((t) => ({ id: t.tag.id, name: t.tag.name, slug: t.tag.slug })) }
}

// ---------- Tags : upsert par slug + liaison article ----------
export async function syncArticleTags(articleId: string, names: string[], replace = false) {
  if (replace) await db.articleTag.deleteMany({ where: { articleId } })
  const seen = new Set<string>()
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    const slug = slugify(name) || `tag-${seen.size + 1}`
    if (seen.has(slug)) continue
    seen.add(slug)
    const tag = await db.tag.upsert({ where: { slug }, update: { name }, create: { name, slug } })
    await db.articleTag.upsert({
      where: { articleId_tagId: { articleId, tagId: tag.id } },
      update: {},
      create: { articleId, tagId: tag.id },
    })
  }
}

// ---------- Catégories : arbre avec compteurs publiés ----------
type CategoryRow = Category & {
  _count: { articles: number; audioContents: number; videos: number }
}
export type CategoryNode = CategoryRow & { children: CategoryNode[] }

export function categoryCountInclude(now = new Date()) {
  const pub = publishedFilter(now)
  return {
    _count: {
      select: {
        articles: { where: { ...pub, deletedAt: null } },
        audioContents: { where: { ...pub, deletedAt: null } },
        videos: { where: { ...pub, deletedAt: null } },
      },
    },
  } satisfies Prisma.CategoryInclude
}

export function buildCategoryTree(rows: CategoryRow[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>()
  for (const row of rows) nodes.set(row.id, { ...row, children: [] })
  const roots: CategoryNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent && parent.id !== node.id) parent.children.push(node)
    else roots.push(node)
  }
  const byOrder = (a: CategoryNode, b: CategoryNode) =>
    a.order - b.order || a.name.localeCompare(b.name, 'fr')
  roots.sort(byOrder)
  for (const node of nodes.values()) node.children.sort(byOrder)
  return roots
}

// ---------- Vues : agrégat journalier + incrémentation ----------
export async function trackView(contentType: string, contentId: string) {
  const day = new Date().toISOString().slice(0, 10)
  try {
    await db.contentView.upsert({
      where: { contentType_contentId_day: { contentType, contentId, day } },
      create: { contentType, contentId, day, count: 1 },
      update: { count: { increment: 1 } },
    })
  } catch {
    // best effort : ne jamais bloquer la lecture d'un contenu
  }
}

// ---------- Utilitaires divers ----------
export function parseIds(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Date optionnelle (chaîne ISO ou Date) — undefined = champ non fourni
export const optionalDate = z
  .union([z.string(), z.date()])
  .nullish()
  .transform((v) => {
    if (v === undefined) return undefined
    if (v === null || v === '') return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? undefined : d
  })
