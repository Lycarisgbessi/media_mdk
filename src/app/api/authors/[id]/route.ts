// =====================================================================
// GET /api/authors/[id] — profil public d'un auteur + statistiques
// =====================================================================

import { db } from '@/lib/db'
import { notFound, ok, publishedFilter } from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const user = await db.user.findFirst({ where: { id, deletedAt: null } })
  if (!user) return notFound('Auteur introuvable')

  // Contenus publiés uniquement, non supprimés
  const pub = publishedFilter()
  const [articles, audio, videos] = await Promise.all([
    db.article.count({ where: { authorId: id, deletedAt: null, ...pub } }),
    db.audioContent.count({ where: { authorId: id, deletedAt: null, ...pub } }),
    db.video.count({ where: { authorId: id, deletedAt: null, ...pub } }),
  ])

  return ok({
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
    },
    stats: { articles, audio, videos },
  })
}
