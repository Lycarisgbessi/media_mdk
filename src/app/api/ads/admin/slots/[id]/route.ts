// =====================================================================
// PUT /api/ads/admin/slots/[id] — activation / désactivation d'un emplacement
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { apiError, jsonOk, readJson, parseWith, requireStaff, ADS_ROLES } from '../../../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  active: z.boolean().optional(),
})

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(ADS_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.adSlot.findUnique({ where: { id } })
  if (!existing) return apiError('Emplacement introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(updateSchema, body)
  if (parsed.error) return parsed.error

  const data: { active?: boolean } = {}
  if (parsed.data.active !== undefined) data.active = parsed.data.active

  const slot = await db.adSlot.update({ where: { id: existing.id }, data })

  await logAudit(user, 'update', 'ad_slot', slot.id, { key: slot.key, active: slot.active })
  return jsonOk({ slot })
}
