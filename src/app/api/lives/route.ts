// =====================================================================
// GET  /api/lives — directs TV (live d'abord, puis programmés, terminés)
// POST /api/lives — création d'un direct (staff vidéo)
// =====================================================================

import { z } from 'zod'
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
  VIDEO_ROLES,
  zDateIn,
} from '../_lib/media-helpers'

export const dynamic = 'force-dynamic'

type LiveRow = {
  status: string
  scheduledStart: Date | null
  actualEnd: Date | null
  createdAt: Date
}

/** Ordre d'affichage : live > scheduled (asc) > ended (desc) > cancelled. */
function statusRank(status: string): number {
  if (status === 'live') return 0
  if (status === 'scheduled') return 1
  if (status === 'ended') return 2
  return 3
}

function sortLives<T extends LiveRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const r = statusRank(a.status) - statusRank(b.status)
    if (r !== 0) return r
    if (a.status === 'scheduled') {
      const ta = a.scheduledStart?.getTime() ?? Number.MAX_SAFE_INTEGER
      const tb = b.scheduledStart?.getTime() ?? Number.MAX_SAFE_INTEGER
      return ta - tb
    }
    if (a.status === 'ended') {
      const ta = a.actualEnd?.getTime() ?? 0
      const tb = b.actualEnd?.getTime() ?? 0
      return tb - ta
    }
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const user = await getOptionalUser()

  // les directs annulés sont masqués côté public (staff : ?all=1)
  const includeAll = searchParams.get('all') === '1' && user !== null
  const where = includeAll ? {} : { status: { not: 'cancelled' } }

  const lives = await db.liveStream.findMany({
    where,
    orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  })

  return jsonOk({ lives: sortLives(lives) })
}

const createSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(250),
  youtubeUrl: z.string().min(1, 'URL YouTube requise'),
  description: z.string().nullish(),
  scheduledStart: zDateIn,
  categoryId: z.string().nullish(),
  featured: z.boolean().optional(),
})

export async function POST(request: Request) {
  const guard = await requireStaff(VIDEO_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(createSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  const youtubeId = parseYouTubeId(data.youtubeUrl)
  if (!youtubeId) return apiError('URL YouTube invalide', 400)

  if (data.categoryId) {
    const category = await db.category.findFirst({ where: { id: data.categoryId, deletedAt: null }, select: { id: true } })
    if (!category) return apiError('Rubrique introuvable', 400)
  }

  const live = await db.liveStream.create({
    data: {
      title: data.title,
      youtubeUrl: data.youtubeUrl,
      youtubeId,
      thumbnailUrl: youtubeThumbnail(youtubeId),
      description: data.description ?? null,
      scheduledStart: data.scheduledStart ?? null,
      categoryId: data.categoryId ?? null,
      featured: data.featured ?? false,
      status: 'scheduled',
    },
  })

  await logAudit(user, 'create', 'live_stream', live.id, { title: live.title })
  return jsonOk({ live }, 201)
}
