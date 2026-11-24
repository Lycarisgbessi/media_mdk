// =====================================================================
// POST /api/share — journalisation des partages (public, silencieux)
// Body : { contentType, contentId, channel }
// =====================================================================

import { db } from '@/lib/db'
import { jsonOk, readJson } from '../_lib/media-helpers'

export const dynamic = 'force-dynamic'

const CONTENT_TYPES = ['article', 'audio', 'video', 'live']

export async function POST(request: Request) {
  const body = await readJson(request)
  const contentType = typeof body?.contentType === 'string' ? body.contentType : ''
  const contentId = typeof body?.contentId === 'string' ? body.contentId : ''
  const channel = typeof body?.channel === 'string' ? body.channel.slice(0, 60) : ''

  // silencieux : données invalides → on répond OK sans rien enregistrer
  if (!contentType || !contentId || !channel) return jsonOk({ ok: true })
  if (!CONTENT_TYPES.includes(contentType)) return jsonOk({ ok: true })

  try {
    await db.shareEvent.create({ data: { contentType, contentId, channel } })
  } catch {
    // silencieux
  }
  return jsonOk({ ok: true })
}
