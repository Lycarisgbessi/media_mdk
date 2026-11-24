// =====================================================================
// POST /api/view — enregistrement d'une vue (public)
// Body : { contentType: 'article'|'audio'|'video'|'live', contentId }
// Tolérant : contenu inexistant → réponse ok sans trace
// =====================================================================

import { z } from 'zod'
import { db } from '@/lib/db'
import { badRequest, ok, trackView } from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

const schema = z.object({
  contentType: z.enum(['article', 'audio', 'video', 'live']),
  contentId: z.string().min(1),
})

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return badRequest('contentType et contentId requis')
  const { contentType, contentId } = parsed.data

  // Incrémente le compteur du contenu ; updateMany renvoie 0 si absent
  let touched = 0
  switch (contentType) {
    case 'article':
      touched = (
        await db.article.updateMany({ where: { id: contentId }, data: { views: { increment: 1 } } })
      ).count
      break
    case 'audio':
      touched = (
        await db.audioContent.updateMany({
          where: { id: contentId },
          data: { views: { increment: 1 } },
        })
      ).count
      break
    case 'video':
      touched = (
        await db.video.updateMany({ where: { id: contentId }, data: { views: { increment: 1 } } })
      ).count
      break
    case 'live':
      touched = (
        await db.liveStream.updateMany({
          where: { id: contentId },
          data: { views: { increment: 1 } },
        })
      ).count
      break
  }

  // Agrégat journalier (uniquement si le contenu existe réellement)
  if (touched > 0) await trackView(contentType, contentId)

  return ok({ ok: true })
}
