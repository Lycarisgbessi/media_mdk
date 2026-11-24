// =====================================================================
// GET  /api/ads?slot=key — créative active pour un emplacement
//      (tirage pondéré, impressions incrémentées)
// POST /api/ads { action: 'click', creativeId } — enregistrement d'un clic
//      (alias de POST /api/ads/click)
// =====================================================================

import { db } from '@/lib/db'
import {
  apiError,
  checkRate,
  clientIpHash,
  jsonOk,
  readJson,
  weightedPick,
  serializeCreative,
} from '../_lib/media-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slotKey = searchParams.get('slot')
  if (!slotKey) return jsonOk({ creative: null })

  const slot = await db.adSlot.findFirst({ where: { key: slotKey, active: true } })
  if (!slot) return jsonOk({ creative: null })

  const now = new Date()
  const creatives = await db.adCreative.findMany({
    where: {
      slotId: slot.id,
      active: true,
      // L'annonceur désactivé stoppe immédiatement toutes ses créatives ;
      // une créative sans annonceur (campagne maison) reste diffusée.
      OR: [{ advertiser: null }, { advertiser: { active: true } }],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    include: {
      slot: { select: { key: true, name: true } },
      advertiser: { select: { name: true } },
    },
  })

  const picked = weightedPick(creatives)
  if (!picked) return jsonOk({ creative: null })

  await db.adCreative.update({ where: { id: picked.id }, data: { impressions: { increment: 1 } } })
  return jsonOk({ creative: serializeCreative({ ...picked, impressions: picked.impressions + 1 }) })
}

export async function POST(request: Request) {
  const body = await readJson(request)
  const creativeId = typeof body?.creativeId === 'string' ? body.creativeId : ''
  if (body?.action !== 'click' || !creativeId) {
    return apiError('Action invalide (attendu : { action: "click", creativeId })', 400)
  }

  // Anti-fraude basique : max 30 clics / minute par IP
  if (!checkRate(`adclick:${clientIpHash(request)}`, 30, 60_000)) {
    return apiError('Trop de clics enregistrés, réessayez plus tard', 429)
  }

  const creative = await db.adCreative.findUnique({ where: { id: creativeId }, select: { id: true } })
  if (!creative) return apiError('Créative introuvable', 404)

  await db.adCreative.update({ where: { id: creative.id }, data: { clicks: { increment: 1 } } })
  return jsonOk({ ok: true })
}
