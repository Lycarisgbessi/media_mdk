// =====================================================================
// /api/flash — bandeau d'informations flash
// GET  : ?active=1 (public) = flashs diffusables + FLASHS AUTOMATIQUES
//        (titres des derniers articles publiés sur 24 h) ; sinon tout (staff)
// POST : création (admin, rédacteur en chef) — flashs manuels
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit, requireRole } from '@/lib/auth'
import {
  ROLES_CONTENT,
  badRequest,
  forbidden,
  ok,
  optionalDate,
  promoteScheduledContent,
} from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------
// GET — liste des flashs
// ---------------------------------------------------------------------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const now = new Date()

  if (searchParams.get('active') === '1') {
    // Publie d'abord les contenus programmés arrivés à échéance : un article
    // planifié publié à l'instant apparaît aussitôt dans le bandeau.
    await promoteScheduledContent()

    // 1) Flashs manuels : actifs et dans leur fenêtre de diffusion
    const manual = await db.flashInfo.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    // 2) Flashs automatiques : les derniers articles publiés (24 h)
    //    alimentent le bandeau sans aucune action de la rédaction.
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const recent = await db.article.findMany({
      where: {
        status: 'published',
        deletedAt: null,
        publishedAt: { not: null, lte: now, gte: since },
      },
      orderBy: { publishedAt: 'desc' },
      take: 6,
      select: { id: true, title: true, slug: true, publishedAt: true },
    })
    const automatic = recent.map((a) => ({
      id: `auto-${a.id}`,
      text: a.title,
      link: `/article/${a.slug}`,
      level: 'info',
      active: true,
      startsAt: a.publishedAt,
      endsAt: null,
    }))

    return ok({ flash: [...manual, ...automatic] })
  }

  // Sans ?active=1 : liste complète réservée au staff
  const staff = await requireRole(ROLES_CONTENT)
  if (!staff) return forbidden('Réservé à la rédaction en chef')

  const flash = await db.flashInfo.findMany({ orderBy: { createdAt: 'desc' } })
  return ok({ flash })
}

// ---------------------------------------------------------------------
// POST — création
// ---------------------------------------------------------------------
const createSchema = z.object({
  text: z.string().min(1, 'Texte requis'),
  link: z.string().nullish(),
  level: z.enum(['info', 'urgent', 'live']).optional(),
  active: z.boolean().optional(),
  startsAt: optionalDate,
  endsAt: optionalDate,
})

export async function POST(req: Request) {
  const user = await requireRole(ROLES_CONTENT)
  if (!user) return forbidden('Réservé à la rédaction en chef')

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Données invalides : un texte est requis')
  const data = parsed.data

  const created = await db.flashInfo.create({
    data: {
      text: data.text,
      link: data.link ?? null,
      level: data.level ?? 'info',
      active: data.active ?? true,
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
    },
  })

  await logAudit(user, 'flash.create', 'flash_info', created.id, { text: created.text })

  return ok({ flash: created }, 201)
}
