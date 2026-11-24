// =====================================================================
// POST /api/ads/click { creativeId } — enregistre un clic publicitaire
// =====================================================================

import { db } from '@/lib/db'
import { apiError, jsonOk, readJson } from '../../_lib/media-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await readJson(request)
  const creativeId = typeof body?.creativeId === 'string' ? body.creativeId : ''
  if (!creativeId) return apiError('creativeId requis', 400)

  const creative = await db.adCreative.findUnique({ where: { id: creativeId }, select: { id: true } })
  if (!creative) return apiError('Créative introuvable', 404)

  await db.adCreative.update({ where: { id: creative.id }, data: { clicks: { increment: 1 } } })
  return jsonOk({ ok: true })
}
