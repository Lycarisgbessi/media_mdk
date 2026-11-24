// =====================================================================
// scripts/ensure-ad-slots.ts — garantit la présence de TOUS les
// emplacements publicitaires (espaces pub) dans la base.
//
// Exécution : bun run scripts/ensure-ad-slots.ts
//
// Idempotent : upsert par `key` avec `update: {}` — un emplacement
// existant n'est JAMAIS écrasé (nom, dimensions, état conservés) ;
// seules les clés manquantes sont créées.
//
// La liste AD_SLOT_DEFS est partagée avec prisma/seed.ts afin qu'un
// seed à neuf crée exactement les mêmes emplacements (mêmes clés/noms).
// Les 4 clés d'origine gardent le nommage du seed, fm_sidebar /
// tv_sidebar / mobile_sticky gardent le nommage créé précédemment par
// scripts/fix-ads.ts, les autres utilisent le nommage de référence.
// =====================================================================

import { PrismaClient } from '@prisma/client'
import type { AdSlot } from '@prisma/client'

export interface AdSlotDef {
  key: string
  name: string
  placement: string
  width?: number
  height?: number
}

// Tous les espaces publicitaires du site (12 emplacements).
export const AD_SLOT_DEFS: AdSlotDef[] = [
  // — Emplacements d'origine (nommage conservé depuis prisma/seed.ts) —
  { key: 'header_banner', name: 'Bandeau haut (728×90)', placement: 'header', width: 728, height: 90 },
  { key: 'home_top', name: 'Accueil — intercalaire (970×250)', placement: 'home_top', width: 970, height: 250 },
  { key: 'sidebar', name: 'Colonne latérale (300×250)', placement: 'sidebar', width: 300, height: 250 },
  { key: 'article_inline', name: 'Article — intercalaire (728×90)', placement: 'article_inline', width: 728, height: 90 },
  // — Nommage conservé depuis scripts/fix-ads.ts —
  { key: 'fm_sidebar', name: 'FM — colonne latérale (300×250)', placement: 'fm_sidebar', width: 300, height: 250 },
  { key: 'tv_sidebar', name: 'TV — colonne latérale (300×250)', placement: 'tv_sidebar', width: 300, height: 250 },
  { key: 'mobile_sticky', name: 'Bandeau collant mobile (320×50)', placement: 'mobile_sticky', width: 320, height: 50 },
  // — Nouveaux emplacements —
  { key: 'home_mid', name: 'Accueil — entre les blocs', placement: 'home_mid', width: 728, height: 90 },
  { key: 'home_bottom', name: 'Accueil — bas de page', placement: 'home_bottom', width: 728, height: 90 },
  { key: 'article_top', name: 'Article — au-dessus du texte', placement: 'article_top', width: 728, height: 90 },
  { key: 'article_bottom', name: 'Article — bas d’article', placement: 'article_bottom', width: 728, height: 90 },
  { key: 'live_top', name: 'En direct — au-dessus du lecteur', placement: 'live_top', width: 728, height: 90 },
]

/**
 * Upsert (par clé) de tous les emplacements : ne crée que les clés
 * manquantes, ne modifie jamais un emplacement existant.
 * Retourne les clés créées / déjà présentes ainsi que les slots indexés par clé.
 */
export async function ensureAdSlots(db: PrismaClient): Promise<{
  created: string[]
  existing: string[]
  slotsByKey: Record<string, AdSlot>
}> {
  const created: string[] = []
  const existing: string[] = []
  const slotsByKey: Record<string, AdSlot> = {}

  for (const def of AD_SLOT_DEFS) {
    const before = await db.adSlot.findUnique({ where: { key: def.key }, select: { id: true } })
    const slot = await db.adSlot.upsert({
      where: { key: def.key },
      update: {}, // ne jamais écraser un emplacement existant
      create: {
        key: def.key,
        name: def.name,
        placement: def.placement,
        active: true,
        width: def.width ?? null,
        height: def.height ?? null,
      },
    })
    slotsByKey[slot.key] = slot
    ;(before ? existing : created).push(def.key)
  }

  return { created, existing, slotsByKey }
}

async function main() {
  const db = new PrismaClient()
  try {
    console.log(`📣 ensure-ad-slots — ${AD_SLOT_DEFS.length} emplacements attendus`)
    const { created, existing } = await ensureAdSlots(db)

    if (created.length > 0) console.log(`   créés   (${created.length}) : ${created.join(', ')}`)
    if (existing.length > 0) console.log(`   présents (${existing.length}) : ${existing.join(', ')}`)

    const total = await db.adSlot.count()
    const slots = await db.adSlot.findMany({ orderBy: { key: 'asc' }, select: { key: true, name: true } })
    console.log(`✅ Total emplacements en base : ${total}`)
    for (const s of slots) console.log(`   - ${s.key} — ${s.name}`)

    if (total < AD_SLOT_DEFS.length) {
      console.error(`⚠️ Attendu au moins ${AD_SLOT_DEFS.length} emplacements, trouvé ${total}`)
      process.exit(1)
    }
  } finally {
    await db.$disconnect()
  }
}

// N'exécute main() que lorsque le script est lancé directement
// (prisma/seed.ts importe ce module sans déclencher l'exécution).
if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
