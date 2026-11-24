// =====================================================================
// GET /api/search?q=&page= — recherche transverse (articles, FM, TV)
// Page : chargement progressif (« Charger plus » côté client).
// =====================================================================

import { db } from '@/lib/db'
import { articleInclude, ok, promoteScheduledContent, publishedFilter, serializeArticle } from '@/app/api/_lib/helpers'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 8

// Selects partagés (mêmes includes que les listes)
const categorySelect = { select: { id: true, name: true, slug: true, color: true, icon: true } }
const authorSelect = { select: { id: true, firstName: true, lastName: true } }
const authorSelectBio = {
  select: { id: true, firstName: true, lastName: true, role: true, bio: true, avatarUrl: true },
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q) return ok({ articles: [], audio: [], videos: [], page: 1, hasMore: false })

  // Garantit la publication des contenus programmés dont la date est atteinte
  await promoteScheduledContent()

  const pageRaw = Number.parseInt(searchParams.get('page') || '1', 10) || 1
  const page = Math.max(1, pageRaw)
  const skip = (page - 1) * PAGE_SIZE
  const now = new Date()
  const pub = publishedFilter(now)

  const [articles, articlesTotal, audio, audioTotal, videos, videosTotal] = await Promise.all([
    db.article.findMany({
      where: {
        deletedAt: null,
        ...pub,
        OR: [{ title: { contains: q, mode: 'insensitive' } }, { lede: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }],
      },
      include: articleInclude,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    db.article.count({
      where: { deletedAt: null, ...pub, OR: [{ title: { contains: q, mode: 'insensitive' } }, { lede: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }] },
    }),
    db.audioContent.findMany({
      where: {
        deletedAt: null,
        ...pub,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { transcription: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { category: categorySelect, author: authorSelect, show: { select: { id: true, name: true, slug: true } } },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    db.audioContent.count({
      where: {
        deletedAt: null,
        ...pub,
        OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { transcription: { contains: q, mode: 'insensitive' } }],
      },
    }),
    db.video.findMany({
      where: {
        deletedAt: null,
        ...pub,
        OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }],
      },
      include: { category: categorySelect, author: authorSelectBio },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    db.video.count({
      where: { deletedAt: null, ...pub, OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] },
    }),
  ])

  const total = articlesTotal + audioTotal + videosTotal
  const maxTotal = Math.max(articlesTotal, audioTotal, videosTotal)
  const hasMore = skip + PAGE_SIZE < maxTotal

  return ok({
    articles: articles.map(serializeArticle),
    audio,
    videos,
    page,
    hasMore,
    totals: { articles: articlesTotal, audio: audioTotal, videos: videosTotal, all: total },
  })
}
