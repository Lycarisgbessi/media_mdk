// =====================================================================
// GET  /api/audio-shows — émissions FM actives (public)
// POST /api/audio-shows — création d'une émission (staff audio)
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import {
  apiError,
  jsonOk,
  readJson,
  parseWith,
  requireStaff,
  getOptionalUser,
  uniqueShowSlug,
  sortSchedule,
  AUDIO_ROLES,
} from '../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(150),
  description: z.string().nullish(),
  coverImageUrl: z.string().nullish(),
  hostNames: z.string().nullish(),
  categoryId: z.string().nullish(),
  driveFolderUrl: z.string().nullish(),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  // ?all=1 (staff) : inclut aussi les émissions désactivées — sans cela,
  // une émission désactivée disparaîtrait de sa propre interface d'admin.
  const wantsAll = searchParams.get('all') === '1'
  const user = wantsAll ? await getOptionalUser() : null
  const staff = !!user && AUDIO_ROLES.includes(user.role)
  const now = new Date()
  const shows = await db.audioShow.findMany({
    where: staff && wantsAll ? { deletedAt: null } : { active: true, deletedAt: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          contents: { where: { status: 'published', publishedAt: { lte: now }, deletedAt: null } },
        },
      },
      schedule: { where: { active: true } },
      category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
    },
  })

  // grille triée par jour (lundi → dimanche) puis heure
  const serialized = shows.map((show) => ({ ...show, schedule: sortSchedule(show.schedule) }))
  return jsonOk({ shows: serialized })
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

  const slug = await uniqueShowSlug(data.name)

  const show = await db.audioShow.create({
    data: {
      name: data.name,
      slug,
      description: data.description ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      hostNames: data.hostNames ?? null,
      categoryId: data.categoryId ?? null,
      driveFolderUrl: data.driveFolderUrl ?? null,
      order: data.order ?? 0,
      active: data.active ?? true,
    },
    include: { schedule: true, _count: { select: { contents: true } } },
  })

  await logAudit(user, 'create', 'audio_show', show.id, { name: show.name })
  return jsonOk({ show }, 201)
}
