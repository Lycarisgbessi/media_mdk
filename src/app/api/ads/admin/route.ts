// =====================================================================
// GET /api/ads/admin — emplacements + créatives + annonceurs (staff pub)
// =====================================================================

import { db } from '@/lib/db'
import { jsonOk, requireStaff, serializeCreative, ADS_ROLES } from '../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireStaff(ADS_ROLES)
  if (!guard.user) return guard.resp

  const [slots, creatives, advertisers] = await Promise.all([
    db.adSlot.findMany({ orderBy: { key: 'asc' } }),
    db.adCreative.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        slot: { select: { key: true, name: true } },
        advertiser: { select: { name: true } },
      },
    }),
    db.advertiser.findMany({ orderBy: { name: 'asc' } }),
  ])

  return jsonOk({ slots, creatives: creatives.map(serializeCreative), advertisers })
}
