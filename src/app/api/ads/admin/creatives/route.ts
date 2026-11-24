// =====================================================================
// POST /api/ads/admin/creatives — création d'une créative (staff pub)
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/auth'
import { apiError, jsonOk, readJson, parseWith, requireStaff, serializeCreative, ADS_ROLES, zDateIn } from '../../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const createSchema = z
  .object({
    name: z.string().min(1, 'Nom requis').max(150),
    slotId: z.string().min(1, 'Emplacement requis'),
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
    // Une créative doit être une image OU du code HTML
    if (!v.imageUrl && !v.htmlCode) {
      ctx.addIssue({ code: 'custom', path: ['imageUrl'], message: 'Fournir une image ou du code HTML' })
    }
    if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'La fin de diffusion doit suivre le début' })
    }
  })

export async function POST(request: Request) {
  const guard = await requireStaff(ADS_ROLES)
  if (!guard.user) return guard.resp
  const user = guard.user

  const body = await readJson(request)
  if (!body) return apiError('Corps de requête invalide', 400)
  const parsed = parseWith(createSchema, body)
  if (parsed.error) return parsed.error
  const data = parsed.data

  const slot = await db.adSlot.findUnique({ where: { id: data.slotId } })
  if (!slot) return apiError('Emplacement introuvable', 400)

  if (data.advertiserId) {
    const advertiser = await db.advertiser.findUnique({ where: { id: data.advertiserId } })
    if (!advertiser) return apiError('Annonceur introuvable', 400)
  }

  const creative = await db.adCreative.create({
    data: {
      name: data.name,
      slotId: data.slotId,
      advertiserId: data.advertiserId ?? null,
      imageUrl: data.imageUrl ?? null,
      htmlCode: data.htmlCode ?? null,
      linkUrl: data.linkUrl ?? null,
      weight: data.weight ?? 1,
      active: data.active ?? true,
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
    },
    include: {
      slot: { select: { key: true, name: true } },
      advertiser: { select: { name: true } },
    },
  })

  await logAudit(user, 'create', 'ad_creative', creative.id, { name: creative.name, slot: slot.key })
  return jsonOk({ creative: serializeCreative(creative) }, 201)
}
