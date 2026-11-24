// =====================================================================
// GET /api/export — export complet des données (admin, sauvegarde JSON)
// Couvre toutes les tables éditoriales et de configuration (hors tables
// techniques : audit, vues agrégées, stats publicitaires).
// =====================================================================

import { db } from '@/lib/db'
import { publicUser } from '@/lib/auth'
import { jsonOk, requireStaff, ADMIN_ROLES } from '../_lib/media-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireStaff(ADMIN_ROLES)
  if (!guard.user) return guard.resp

  const [
    articles,
    audio,
    videos,
    lives,
    settings,
    users,
    messages,
    categories,
    flashes,
    comments,
    pages,
    homepageBlocks,
    audioShows,
    audioShowSchedules,
    ads,
    typography,
  ] = await Promise.all([
    db.article.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    db.audioContent.findMany({ orderBy: { createdAt: 'desc' } }),
    db.video.findMany({ orderBy: { createdAt: 'desc' } }),
    db.liveStream.findMany({ orderBy: { createdAt: 'desc' } }),
    db.siteSetting.findMany(),
    db.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' } }),
    db.contactMessage.findMany({ orderBy: { createdAt: 'desc' } }),
    db.category.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    db.flashInfo.findMany({ orderBy: { createdAt: 'desc' } }),
    db.comment.findMany({ orderBy: { createdAt: 'desc' } }),
    db.page.findMany({ orderBy: { title: 'asc' } }),
    db.homepageBlock.findMany({ orderBy: { order: 'asc' } }),
    db.audioShow.findMany({ include: { schedule: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    db.audioSchedule.findMany({ orderBy: { day: 'asc' } }),
    db.$transaction([
      db.adSlot.findMany({ orderBy: { key: 'asc' } }),
      db.advertiser.findMany({ orderBy: { name: 'asc' } }),
      db.adCreative.findMany({ orderBy: { createdAt: 'desc' } }),
    ]),
    db.typographyOption.findMany({ orderBy: { name: 'asc' } }),
  ])

  const [adSlots, advertisers, adCreatives] = ads

  const data = {
    exportedAt: new Date().toISOString(),
    articles: articles.map((a) => ({ ...a, tags: a.tags.map((t) => t.tag) })),
    audio,
    videos,
    lives,
    settings,
    users: users.map(publicUser),
    messages,
    categories,
    flashes,
    comments,
    pages,
    homepageBlocks,
    audioShows,
    audioSchedules: audioShowSchedules,
    adSlots,
    advertisers,
    adCreatives,
    typography,
  }

  return jsonOk({ data })
}
