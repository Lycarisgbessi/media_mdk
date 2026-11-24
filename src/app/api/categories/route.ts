// =====================================================================
// /api/categories
// GET  : arbre des rubriques (public = actives ; ?all=1 pour le staff)
// POST : création (admin, rédacteur en chef)
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit, requireRole } from '@/lib/auth'
import {
  ROLES_CONTENT,
  badRequest,
  buildCategoryTree,
  categoryCountInclude,
  forbidden,
  ok,
  uniqueSlug,
} from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------
// GET — arbre trié par ordre, avec compteurs de contenus publiés
// ---------------------------------------------------------------------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const staff = await requireRole(ROLES_CONTENT)
  const all = searchParams.get('all') === '1' && !!staff

  const rows = await db.category.findMany({
    where: { deletedAt: null, ...(all ? {} : { active: true }) },
    include: categoryCountInclude(),
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })

  return ok({ categories: buildCategoryTree(rows) })
}

// ---------------------------------------------------------------------
// POST — création de rubrique
// ---------------------------------------------------------------------
const createSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  parentId: z.string().nullish(),
  color: z.string().optional(),
  icon: z.string().nullish(),
  description: z.string().nullish(),
  order: z.number().int().optional(),
  visibleMenu: z.boolean().optional(),
  visibleHome: z.boolean().optional(),
  active: z.boolean().optional(),
  metaTitle: z.string().nullish(),
  metaDescription: z.string().nullish(),
  imageUrl: z.string().nullish(),
})

export async function POST(req: Request) {
  const user = await requireRole(ROLES_CONTENT)
  if (!user) return forbidden('Réservé à la rédaction en chef')

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Données invalides : un nom est requis')
  const data = parsed.data

  if (data.parentId) {
    const parent = await db.category.findFirst({ where: { id: data.parentId, deletedAt: null } })
    if (!parent) return badRequest('Rubrique parente introuvable')
  }

  const slug = await uniqueSlug(data.name, (s) =>
    db.category.findUnique({ where: { slug: s } }).then((r) => !!r)
  )

  const created = await db.category.create({
    data: {
      name: data.name,
      slug,
      parentId: data.parentId ?? null,
      color: data.color ?? '#0A0A0A',
      icon: data.icon ?? null,
      description: data.description ?? null,
      order: data.order ?? 0,
      visibleMenu: data.visibleMenu ?? true,
      visibleHome: data.visibleHome ?? true,
      active: data.active ?? true,
      metaTitle: data.metaTitle ?? null,
      metaDescription: data.metaDescription ?? null,
      imageUrl: data.imageUrl ?? null,
    },
  })

  await logAudit(user, 'category.create', 'category', created.id, { name: created.name })

  return ok({ category: created }, 201)
}
