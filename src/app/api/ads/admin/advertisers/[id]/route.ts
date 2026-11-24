// =====================================================================
// PUT    /api/ads/admin/advertisers/[id] — mise à jour d'un annonceur
// DELETE /api/ads/admin/advertisers/[id] — suppression
//        (les créatives liées passent avec advertiserId = null)
// =====================================================================

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { apiError, jsonOk, readJson, parseWith, requireStaff, ADS_ROLES } from '../../../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(150).optional(),
  contactName: z.string().max(150).nullish(),
  email: z.string().email('Email invalide').max(200).nullish(),
  phone: z.string().max(40).nullish(),
  active: z.boolean().optional(),
})

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(ADS_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.advertiser.findUnique({ where: { id } })
  if (!existing) return apiError('Annonceur introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(updateSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  const patch: Prisma.AdvertiserUncheckedUpdateInput = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.contactName !== undefined) patch.contactName = data.contactName
  if (data.email !== undefined) patch.email = data.email
  if (data.phone !== undefined) patch.phone = data.phone
  if (data.active !== undefined) patch.active = data.active

  const advertiser = await db.advertiser.update({ where: { id: existing.id }, data: patch })

  await logAudit(user, 'update', 'advertiser', advertiser.id, { name: advertiser.name })
  return jsonOk({ advertiser })
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(ADS_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.advertiser.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!existing) return apiError('Annonceur introuvable', 404)

  await db.advertiser.delete({ where: { id: existing.id } })
  await logAudit(user, 'delete', 'advertiser', existing.id, { name: existing.name })
  return jsonOk({ ok: true })
}
