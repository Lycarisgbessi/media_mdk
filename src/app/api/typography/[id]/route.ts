// =====================================================================
// /api/typography/[id]
// PUT : mise à jour (admin, rédacteur en chef)
// DELETE : suppression définitive
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit, requireRole } from '@/lib/auth'
import { ROLES_CONTENT, badRequest, forbidden, notFound, ok } from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    cssFamily: z.string().min(1).optional(),
    usage: z.enum(['titres', 'corps']).optional(),
    active: z.boolean().optional(),
    order: z.number().int().optional(),
  })
  .partial()

// ---------------------------------------------------------------------
// PUT — mise à jour
// ---------------------------------------------------------------------
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(ROLES_CONTENT)
  if (!user) return forbidden('Réservé à la rédaction en chef')

  const { id } = await ctx.params
  const existing = await db.typographyOption.findUnique({ where: { id } })
  if (!existing) return notFound('Option de typographie introuvable')

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Données invalides')
  const data = parsed.data

  const updated = await db.typographyOption.update({
    where: { id },
    data: {
      name: data.name,
      cssFamily: data.cssFamily,
      usage: data.usage,
      active: data.active,
      order: data.order,
    },
  })

  await logAudit(user, 'typography.update', 'typography_option', id, { name: updated.name })

  return ok({ option: updated })
}

// ---------------------------------------------------------------------
// DELETE — suppression définitive
// ---------------------------------------------------------------------
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(ROLES_CONTENT)
  if (!user) return forbidden('Réservé à la rédaction en chef')

  const { id } = await ctx.params
  const existing = await db.typographyOption.findUnique({ where: { id } })
  if (!existing) return notFound('Option de typographie introuvable')

  await db.typographyOption.delete({ where: { id } })
  await logAudit(user, 'typography.delete', 'typography_option', id, { name: existing.name })

  return ok({ ok: true })
}
