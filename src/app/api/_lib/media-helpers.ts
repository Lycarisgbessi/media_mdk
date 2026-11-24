// =====================================================================
// Helpers communs aux routes API média — Task 2-d
// (audio, vidéo, lives, commentaires, pub, contact, stats)
// Ne pas confondre avec src/lib/helpers.ts (utilitaires partagés globaux)
// =====================================================================

import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser, hashIp } from '@/lib/auth'
import { slugify } from '@/lib/helpers'

// ---------- Réponses standardisées ----------

export function apiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function jsonOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

// ---------- Auth / rôles ----------

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>

/** Vérifie la session + le rôle. Renvoie l'utilisateur ou une réponse d'erreur prête à retourner. */
export async function requireStaff(
  roles: string[]
): Promise<{ user: SessionUser; resp: null } | { user: null; resp: NextResponse }> {
  const user = await getSessionUser()
  if (!user) return { user: null, resp: apiError('Non authentifié', 401) }
  if (!roles.includes(user.role)) return { user: null, resp: apiError('Accès refusé', 403) }
  return { user, resp: null }
}

/** Utilisateur connecté (n'importe quel rôle staff) ou null — pour les GET `status=all` / `all=1`. */
export async function getOptionalUser(): Promise<SessionUser | null> {
  return getSessionUser()
}

export const AUDIO_ROLES = ['admin', 'editor_in_chief', 'audio_producer']
export const VIDEO_ROLES = ['admin', 'editor_in_chief', 'video_manager']
export const MODERATION_ROLES = ['admin', 'editor_in_chief', 'moderator']
export const ADS_ROLES = ['admin', 'ad_manager']
export const ADMIN_ROLES = ['admin']
export const ALL_ROLES = [
  'admin',
  'editor_in_chief',
  'journalist',
  'audio_producer',
  'video_manager',
  'moderator',
  'ad_manager',
] as const

export const ROLE_ORDER: readonly string[] = [
  'admin',
  'editor_in_chief',
  'journalist',
  'audio_producer',
  'video_manager',
  'moderator',
  'ad_manager',
]

export const CONTENT_STATUSES = ['draft', 'review', 'approved', 'scheduled', 'published', 'archived'] as const
const CONTENT_STATUS_STRINGS: readonly string[] = CONTENT_STATUSES

// ---------- Corps de requête ----------

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
    return null
  } catch {
    return null
  }
}

export function parseWith<S extends z.ZodType>(
  schema: S,
  body: unknown
): { data: z.output<S>; error: null } | { data: null; error: NextResponse } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues[0]?.message || 'Données invalides'
    return { data: null, error: apiError(message, 400) }
  }
  return { data: result.data, error: null }
}

// ---------- Dates (champs optionnels : undefined = inchangé, null = effacé) ----------

export const zDateIn = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v, ctx): Date | null | undefined => {
    if (v === undefined) return undefined
    if (v === null || v === '') return null
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Date invalide' })
      return z.NEVER
    }
    return d
  })

// ---------- Pagination ----------

export function getPagination(searchParams: URLSearchParams, defaultLimit = 12) {
  const rawLimit = parseInt(searchParams.get('limit') ?? '', 10)
  const rawPage = parseInt(searchParams.get('page') ?? '', 10)
  const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? defaultLimit : rawLimit, 1), 100)
  const page = Math.max(Number.isNaN(rawPage) ? 1 : rawPage, 1)
  return { limit, page, skip: (page - 1) * limit }
}

// ---------- Filtre "publié" (status + publishedAt <= now) ----------

export function publishedFilter() {
  return { status: 'published', publishedAt: { lte: new Date() } }
}

/** Détermine le filtre de statut pour les listes : public → publiés ; staff → all ou statut précis. */
export function statusFilterFor(statusParam: string | null, isStaff: boolean): Record<string, unknown> {
  const status = statusParam ?? 'published'
  if (!isStaff) return publishedFilter()
  if (status === 'all') return {}
  if (CONTENT_STATUS_STRINGS.includes(status)) return { status }
  return publishedFilter()
}

// ---------- Slugs uniques ----------

async function findUniqueSlug(
  base: string,
  isTaken: (slug: string) => Promise<{ id: string } | null>,
  excludeId?: string
): Promise<string> {
  const root = slugify(base) || 'contenu'
  let candidate = root
  let n = 2
  for (;;) {
    const existing = await isTaken(candidate)
    if (!existing || existing.id === excludeId) return candidate
    candidate = `${root}-${n}`
    n += 1
  }
}

export function uniqueAudioSlug(base: string, excludeId?: string): Promise<string> {
  return findUniqueSlug(base, (s) => db.audioContent.findUnique({ where: { slug: s }, select: { id: true } }), excludeId)
}

export function uniqueShowSlug(base: string, excludeId?: string): Promise<string> {
  return findUniqueSlug(base, (s) => db.audioShow.findUnique({ where: { slug: s }, select: { id: true } }), excludeId)
}

// ---------- Vues (compteur + statistiques journalières) ----------

export async function trackView(contentType: string, contentId: string): Promise<void> {
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

// ---------- Rate limiting (mémoire locale, 5 messages/minute) ----------

export const rateMap = new Map<string, number[]>()

export function checkRate(key: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  const hits = (rateMap.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= max) {
    rateMap.set(key, hits)
    return false
  }
  hits.push(now)
  rateMap.set(key, hits)
  if (rateMap.size > 10_000) {
    for (const [k, v] of rateMap) {
      if (v.every((t) => now - t >= windowMs)) rateMap.delete(k)
    }
  }
  return true
}

/** Hash RGPD de l'IP du client (en-tête x-forwarded-for). */
export function clientIpHash(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') ?? ''
  const ip = fwd.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return hashIp(ip)
}

// ---------- Includes Prisma réutilisables ----------

export const AUDIO_INCLUDE = {
  show: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
  author: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.AudioContentInclude

export const VIDEO_INCLUDE = {
  category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
  author: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.VideoInclude

// NB : LiveStream n'a pas de relation Prisma (categoryId est une simple chaîne),
// pas d'include possible pour les directs.

// ---------- Émissions (grille de programme) ----------

export const DAYS_FR = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const

export function sortSchedule<T extends { day: string; time: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const d = DAYS_FR.indexOf(a.day as (typeof DAYS_FR)[number]) - DAYS_FR.indexOf(b.day as (typeof DAYS_FR)[number])
    if (d !== 0) return d
    return a.time.localeCompare(b.time)
  })
}

// ---------- Lives : transitions de statut autorisées ----------

export const LIVE_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['live', 'cancelled'],
  live: ['ended', 'cancelled'],
  ended: [],
  cancelled: [],
}

// ---------- Publicité ----------

/** Tirage pondéré par `weight`. */
export function weightedPick<T extends { weight: number }>(items: T[]): T | null {
  const pool = items.filter((i) => i.weight > 0)
  if (pool.length === 0) return null
  const total = pool.reduce((sum, i) => sum + i.weight, 0)
  let r = Math.random() * total
  for (const item of pool) {
    r -= item.weight
    if (r <= 0) return item
  }
  return pool[pool.length - 1]
}

type CreativeRow = Prisma.AdCreativeGetPayload<{
  include: { slot: { select: { key: true; name: true } }; advertiser: { select: { name: true } } }
}>

export function serializeCreative(c: CreativeRow) {
  return {
    id: c.id,
    slotId: c.slotId,
    slotKey: c.slot?.key ?? null,
    slotName: c.slot?.name ?? null,
    advertiserId: c.advertiserId,
    advertiserName: c.advertiser?.name ?? null,
    name: c.name,
    imageUrl: c.imageUrl,
    htmlCode: c.htmlCode,
    linkUrl: c.linkUrl,
    weight: c.weight,
    active: c.active,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    impressions: c.impressions,
    clicks: c.clicks,
  }
}

// ---------- Commentaires : retirer les champs privés (RGPD) ----------

export function stripPrivate<T extends object>(row: T): Record<string, unknown> {
  const copy = { ...row } as Record<string, unknown>
  delete copy.authorEmail
  delete copy.ipHash
  return copy
}
