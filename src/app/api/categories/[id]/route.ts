// =====================================================================
// /api/categories/[id]
// PUT : mise à jour (admin, rédacteur en chef)
// DELETE : suppression logique — refusée si contenu ou sous-rubriques
// =====================================================================

import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit, requireRole } from '@/lib/auth'
import {
  ROLES_CONTENT,
  apiError,
  badRequest,
  forbidden,
  notFound,
  ok,
  uniqueSlug,
} from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z.string().optional(),
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
  .partial()

// ---------------------------------------------------------------------
// PUT — mise à jour
// ---------------------------------------------------------------------
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(ROLES_CONTENT)
  if (!user) return forbidden('Réservé à la rédaction en chef')

  const { id } = await ctx.params
  const existing = await db.category.findFirst({ where: { id, deletedAt: null } })
  if (!existing) return notFound('Rubrique introuvable')

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Données invalides')
  const data = parsed.data

  // Parent : pas lui-même, doit exister
  if (data.parentId !== undefined && data.parentId) {
    if (data.parentId === id) return badRequest('Une rubrique ne peut être sa propre parente')
    const parent = await db.category.findFirst({ where: { id: data.parentId, deletedAt: null } })
    if (!parent) return badRequest('Rubrique parente introuvable')
  }

  // Slug : re-vérifié uniquement si explicitement fourni
  let slug: string | undefined = undefined
  if (data.slug) {
    slug = await uniqueSlug(data.slug, (s) =>
      db.category.findFirst({ where: { slug: s, id: { not: id } } }).then((r) => !!r)
    )
  }

  const updateData: Prisma.CategoryUncheckedUpdateInput = {
    name: data.name,
    slug,
    parentId: data.parentId,
    color: data.color,
    icon: data.icon,
    description: data.description,
    order: data.order,
    visibleMenu: data.visibleMenu,
    visibleHome: data.visibleHome,
    active: data.active,
    metaTitle: data.metaTitle,
    metaDescription: data.metaDescription,
    imageUrl: data.imageUrl,
  }

  const updated = await db.category.update({ where: { id }, data: updateData })
  await logAudit(user, 'category.update', 'category', id, { name: updated.name })

  return ok({ category: updated })
}

// ---------------------------------------------------------------------
// DELETE — suppression logique avec garde-fou contenu / sous-rubriques
// ---------------------------------------------------------------------
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(ROLES_CONTENT)
  if (!user) return forbidden('Réservé à la rédaction en chef')

  const { id } = await ctx.params
  const existing = await db.category.findFirst({ where: { id, deletedAt: null } })
  if (!existing) return notFound('Rubrique introuvable')

  // Refus si la rubrique contient encore du contenu ou des sous-rubriques
  const [articles, audio, videos, children] = await Promise.all([
    db.article.count({ where: { categoryId: id, deletedAt: null } }),
    db.audioContent.count({ where: { categoryId: id, deletedAt: null } }),
    db.video.count({ where: { categoryId: id, deletedAt: null } }),
    db.category.count({ where: { parentId: id, deletedAt: null } }),
  ])
  if (articles > 0 || audio > 0 || videos > 0 || children > 0) {
    return apiError('Déplacez ou archivez d’abord le contenu', 409)
  }

  await db.category.update({ where: { id }, data: { deletedAt: new Date() } })
  await logAudit(user, 'category.delete', 'category', id, { name: existing.name })

  return ok({ ok: true })
}
