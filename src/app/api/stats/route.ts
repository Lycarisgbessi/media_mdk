// =====================================================================
// GET /api/stats — statistiques du tableau de bord (staff)
// Réponse : DashboardStats (disponible aussi sous la clé `stats`)
// =====================================================================

import type { DashboardStats } from '@/lib/types'
import { db } from '@/lib/db'
import { apiError, jsonOk, getOptionalUser } from '../_lib/media-helpers'
import { promoteScheduledContent } from '../_lib/helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getOptionalUser()
  if (!user) return apiError('Non authentifié', 401)

  // Le tableau de bord est ouvert en continu par la rédaction : il sert aussi
  // de point de promotion des contenus programmés dont la date est atteinte.
  await promoteScheduledContent()

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const publishedWhere = { status: 'published', publishedAt: { lte: now } }

  const [
    todayViewsAgg,
    totalArticles,
    publishedArticles,
    totalAudio,
    totalVideos,
    pendingComments,
    unreadMessages,
    pendingArticles,
    activeLives,
  ] = await Promise.all([
    db.contentView.aggregate({ _sum: { count: true }, where: { day: today } }),
    db.article.count({ where: { deletedAt: null } }),
    db.article.count({ where: { deletedAt: null, ...publishedWhere } }),
    db.audioContent.count({ where: { deletedAt: null, ...publishedWhere } }),
    db.video.count({ where: { deletedAt: null, ...publishedWhere } }),
    db.comment.count({ where: { status: 'pending' } }),
    db.contactMessage.count({ where: { status: 'new' } }),
    db.article.count({ where: { deletedAt: null, status: { in: ['review', 'approved'] } } }),
    db.liveStream.count({ where: { status: 'live' } }),
  ])

  // Top contenus (5 max, publiés, triés par vues)
  const [topArticles, topAudio, topVideos] = await Promise.all([
    db.article.findMany({
      where: { deletedAt: null, ...publishedWhere },
      orderBy: { views: 'desc' },
      take: 5,
      select: { id: true, title: true, slug: true, views: true },
    }),
    db.audioContent.findMany({
      where: { deletedAt: null, ...publishedWhere },
      orderBy: { views: 'desc' },
      take: 5,
      select: { id: true, title: true, slug: true, views: true },
    }),
    db.video.findMany({
      where: { deletedAt: null, ...publishedWhere },
      orderBy: { views: 'desc' },
      take: 5,
      select: { id: true, title: true, views: true },
    }),
  ])

  // Vues des 14 derniers jours
  const days: string[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  const viewsGrouped = await db.contentView.groupBy({
    by: ['day'],
    where: { day: { in: days } },
    _sum: { count: true },
  })
  const sumByDay = new Map(viewsGrouped.map((g) => [g.day, g._sum.count ?? 0]))
  const viewsByDay = days.map((day) => ({ day, count: sumByDay.get(day) ?? 0 }))

  // Articles publiés par rubrique (top 8)
  const byCatGrouped = await db.article.groupBy({
    by: ['categoryId'],
    where: { deletedAt: null, ...publishedWhere, categoryId: { not: null } },
    _count: { _all: true },
  })
  const catIds = byCatGrouped.map((g) => g.categoryId).filter((v): v is string => typeof v === 'string')
  const categories = catIds.length
    ? await db.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } })
    : []
  const catNames = new Map(categories.map((c) => [c.id, c.name]))
  const byCategory = byCatGrouped
    .map((g) => ({
      name: (g.categoryId ? catNames.get(g.categoryId) : null) ?? 'Sans rubrique',
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const stats: DashboardStats = {
    todayViews: todayViewsAgg._sum.count ?? 0,
    totalArticles,
    publishedArticles,
    totalAudio,
    totalVideos,
    pendingComments,
    unreadMessages,
    pendingArticles,
    activeLives,
    topArticles,
    topAudio,
    topVideos: topVideos.map((v) => ({ ...v, id2: v.id })),
    viewsByDay,
    byCategory,
  }

  // compatible avec les deux consommations : data.todayViews ou data.stats.todayViews
  return jsonOk({ ...stats, stats })
}
