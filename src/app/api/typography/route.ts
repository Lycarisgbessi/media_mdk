// =====================================================================
// /api/typography — polices proposées pour les articles (§17.4)
// GET (public) : options actives ; POST (admin) : création
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit, requireRole } from '@/lib/auth'
import { ROLES_ADMIN, badRequest, forbidden, ok } from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------
// GET — options actives, triées
// ---------------------------------------------------------------------
export async function GET() {
  const options = await db.typographyOption.findMany({
    where: { active: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })
  return ok({ options })
}

// ---------------------------------------------------------------------
// POST — création (admin seul)
// ---------------------------------------------------------------------
const createSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  cssFamily: z.string().min(1, 'Famille CSS requise'),
  usage: z.enum(['titres', 'corps']).optional(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
})

export async function POST(req: Request) {
  const user = await requireRole(ROLES_ADMIN)
  if (!user) return forbidden('Réservé à l’administrateur')

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Données invalides : nom et famille CSS requis')
  const data = parsed.data

  const created = await db.typographyOption.create({
    data: {
      name: data.name,
      cssFamily: data.cssFamily,
      usage: data.usage ?? 'corps',
      active: data.active ?? true,
      order: data.order ?? 0,
    },
  })

  await logAudit(user, 'typography.create', 'typography_option', created.id, { name: created.name })

  return ok({ option: created }, 201)
}
