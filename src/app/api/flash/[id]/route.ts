// =====================================================================
// /api/flash/[id]
// PUT : mise à jour (admin, rédacteur en chef)
// DELETE : suppression définitive
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit, requireRole } from '@/lib/auth'
import { ROLES_CONTENT, badRequest, forbidden, notFound, ok, optionalDate } from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

const updateSchema = z
  .object({
    text: z.string().min(1).optional(),
    link: z.string().nullish(),
    level: z.enum(['info', 'urgent', 'live']).optional(),
    active: z.boolean().optional(),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .partial()

// ---------------------------------------------------------------------
// PUT — mise à jour
// ---------------------------------------------------------------------
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(ROLES_CONTENT)
  if (!user) return forbidden('Réservé à la rédaction en chef')

  const { id } = await ctx.params
  const existing = await db.flashInfo.findUnique({ where: { id } })
  if (!existing) return notFound('Flash introuvable')

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('Données invalides')
  const data = parsed.data

  const updated = await db.flashInfo.update({
    where: { id },
    data: {
      text: data.text,
      link: data.link,
      level: data.level,
      active: data.active,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    },
  })

  await logAudit(user, 'flash.update', 'flash_info', id, { text: updated.text })

  return ok({ flash: updated })
}

// ---------------------------------------------------------------------
// DELETE — suppression définitive (pas de soft delete sur les flashs)
// ---------------------------------------------------------------------
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(ROLES_CONTENT)
  if (!user) return forbidden('Réservé à la rédaction en chef')

  const { id } = await ctx.params
  const existing = await db.flashInfo.findUnique({ where: { id } })
  if (!existing) return notFound('Flash introuvable')

  await db.flashInfo.delete({ where: { id } })
  await logAudit(user, 'flash.delete', 'flash_info', id, { text: existing.text })

  return ok({ ok: true })
}
