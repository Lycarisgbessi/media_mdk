// =====================================================================
// scripts/fix-ads.ts — réparation des données publicitaires :
// 1) crée les emplacements manquants (tv_sidebar, fm_sidebar, mobile_sticky) ;
// 2) ajoute une créative de démonstration pour article_inline ;
// 3) prolonge les dates de diffusion des créatives existantes (le seed
//    utilisait des dates relatives déjà expirées → placeholder permanent).
// Exécution : bun scripts/fix-ads.ts
// =====================================================================

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const daysFromNow = (d: number) => new Date(Date.now() + d * 24 * 3600 * 1000)

async function main() {
  // ---- 1. Emplacements manquants (clés référencées par le site public) ----
  const wanted = [
    { key: 'tv_sidebar', name: 'TV — colonne latérale (300×250)', placement: 'tv_sidebar', width: 300, height: 250 },
    { key: 'fm_sidebar', name: 'FM — colonne latérale (300×250)', placement: 'fm_sidebar', width: 300, height: 250 },
    { key: 'mobile_sticky', name: 'Bandeau collant mobile (320×50)', placement: 'mobile_sticky', width: 320, height: 50 },
  ]
  for (const w of wanted) {
    const existing = await db.adSlot.findUnique({ where: { key: w.key } })
    if (existing) {
      console.log(`slot ${w.key} : déjà présent`)
    } else {
      await db.adSlot.create({ data: { ...w, active: true } })
      console.log(`slot ${w.key} : créé`)
    }
  }

  // ---- 2. Créative de démonstration pour article_inline ----
  const slotArticle = await db.adSlot.findUnique({ where: { key: 'article_inline' } })
  if (slotArticle) {
    const hasCreative = await db.adCreative.findFirst({ where: { slotId: slotArticle.id } })
    if (!hasCreative) {
      const advertiser = (await db.advertiser.findFirst({ where: { active: true } })) ??
        (await db.advertiser.create({ data: { name: 'Annonceur démo', active: true } }))
      await db.adCreative.create({
        data: {
          slotId: slotArticle.id,
          advertiserId: advertiser.id,
          name: 'Encart article — démo',
          imageUrl: '/ads/orbis-banner.svg',
          linkUrl: null,
          weight: 1,
          active: true,
          startsAt: new Date(),
          endsAt: daysFromNow(365),
        },
      })
      console.log('creative article_inline : créée')
    } else {
      console.log('creative article_inline : déjà présente')
    }
  }

  // ---- 3. Prolongation des fenêtres de diffusion expirées ----
  const now = new Date()
  const expired = await db.adCreative.findMany({
    where: { active: true, OR: [{ endsAt: { lte: now } }, { startsAt: { gt: now } }] },
    select: { id: true, name: true, endsAt: true },
  })
  for (const c of expired) {
    await db.adCreative.update({
      where: { id: c.id },
      data: { startsAt: now, endsAt: daysFromNow(365) },
    })
    console.log(`creative « ${c.name} » : fenêtre prolongée de 1 an`)
  }
  if (expired.length === 0) console.log('aucune créative expirée')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
