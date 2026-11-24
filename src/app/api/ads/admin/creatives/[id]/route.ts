// =====================================================================
// PUT    /api/ads/admin/creatives/[id] — mise à jour d'une créative
// DELETE /api/ads/admin/creatives/[id] — suppression
// =====================================================================

import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { apiError, jsonOk, readJson, parseWith, requireStaff, serializeCreative, ADS_ROLES, zDateIn } from '../../../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const updateSchema = z
  .object({
    name: z.string().min(1, 'Nom requis').max(150).optional(),
    slotId: z.string().min(1, 'Emplacement invalide').optional(),
    advertiserId: z.string().nullish(),
    imageUrl: z.string().nullish(),
    htmlCode: z.string().nullish(),
    linkUrl: z.string().nullish(),
    weight: z.number().int().min(1, 'Poids minimum : 1').max(100).optional(),
    active: z.boolean().optional(),
    startsAt: zDateIn,
    endsAt: zDateIn,
  })
  .superRefine((v, ctx) => {
    if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'La fin de diffusion doit suivre le début' })
    }
  })

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(ADS_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.adCreative.findUnique({ where: { id } })
  if (!existing) return apiError('Créative introuvable', 404)

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(updateSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  if (data.slotId && data.slotId !== existing.slotId) {
    const slot = await db.adSlot.findUnique({ where: { id: data.slotId } })
    if (!slot) return apiError('Emplacement introuvable', 400)
  }
  if (data.advertiserId) {
    const advertiser = await db.advertiser.findUnique({ where: { id: data.advertiserId } })
    if (!advertiser) return apiError('Annonceur introuvable', 400)
  }

  const patch: Prisma.AdCreativeUncheckedUpdateInput = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.slotId !== undefined) patch.slotId = data.slotId
  if (data.advertiserId !== undefined) patch.advertiserId = data.advertiserId
  if (data.imageUrl !== undefined) patch.imageUrl = data.imageUrl
  if (data.htmlCode !== undefined) patch.htmlCode = data.htmlCode
  if (data.linkUrl !== undefined) patch.linkUrl = data.linkUrl
  if (data.weight !== undefined) patch.weight = data.weight
  if (data.active !== undefined) patch.active = data.active
  if (data.startsAt !== undefined) patch.startsAt = data.startsAt
  if (data.endsAt !== undefined) patch.endsAt = data.endsAt

  const creative = await db.adCreative.update({
    where: { id: existing.id },
    data: patch,
    include: {
      slot: { select: { key: true, name: true } },
      advertiser: { select: { name: true } },
    },
  })

  // Garde-fou : une créative active doit toujours avoir un visuel
  if (creative.active && !creative.imageUrl && !creative.htmlCode) {
    await db.adCreative.update({ where: { id: creative.id }, data: { active: false } })
  }

  const fresh = await db.adCreative.findUnique({
    where: { id: creative.id },
    include: {
      slot: { select: { key: true, name: true } },
      advertiser: { select: { name: true } },
    },
  })
  await logAudit(user, 'update', 'ad_creative', creative.id, { name: creative.name })
  return jsonOk({ creative: serializeCreative(fresh ?? creative) })
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(ADS_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const { id } = await ctx.params
  const existing = await db.adCreative.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!existing) return apiError('Créative introuvable', 404)

  await db.adCreative.delete({ where: { id: existing.id } })
  await logAudit(user, 'delete', 'ad_creative', existing.id, { name: existing.name })
  return jsonOk({ ok: true })
}
