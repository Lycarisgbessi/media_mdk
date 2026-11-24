'use client'

import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { AdCreativePayload } from '@/lib/types'

/**
 * Cache module-level : évite de re-fetcher (et donc de re-compter
 * une impression) pour un même emplacement pendant la session SPA.
 * Une réponse vide (null) est mise en cache ; une ERREUR réseau ne l'est
 * pas — le prochain montage réessaiera (résilience aux pannes passagères).
 *
 * Invalidation : le cache est vidé quand on quitte l'espace pro pour
 * revenir sur le site (voir invalidateAdCache + AppShell) — une créative
 * ajoutée ou modifiée dans le tableau de bord devient visible immédiatement.
 */
const slotCache = new Map<string, AdCreativePayload | null>()

/** Vide le cache des créatives (tout, ou un emplacement donné).
 *  Appelé par AppShell lors du retour du back-office vers le site public. */
export function invalidateAdCache(slot?: string): void {
  if (slot) slotCache.delete(slot)
  else slotCache.clear()
}

interface AdSlotViewProps {
  slot: string
  className?: string
  /** Hauteur minimale pour éviter le CLS (défaut 120px) */
  minHeight?: number
  /** Ne rien afficher tant qu'aucune créative n'est chargée (ni skeleton
   *  ni placeholder « Espace publicitaire ») — utilisé pour les emplacements
   *  intrusifs comme le bandeau collant mobile. */
  hideWhenEmpty?: boolean
  /** Hauteur fixe imposée à la créative (recadrage « cover ») — garantit
   *  qu'une image de taille quelconque respecte le format de l'emplacement
   *  (ex. bandeau collant mobile 320×50). */
  maxHeight?: number
  /** Notifie le parent qu'une créative est affichée (ou non) — permet de
   *  réserver l'espace correspondant dans la mise en page. */
  onLoaded?: (creative: AdCreativePayload | null) => void
}

/** Traduit un chemin interne (/live, /tv, /rubrique/…) en navigation SPA. */
export function navigateFromPath(path?: string | null) {
  if (!path) return
  const navigate = useAppStore.getState().navigate
  const p = path.split('?')[0].replace(/\/+$/, '')
  if (p === '' || p === '/') return navigate({ name: 'home' })
  if (p.startsWith('/live')) return navigate({ name: 'live', id: p.split('/')[2] || undefined })
  if (p.startsWith('/tv')) return navigate({ name: 'tv' })
  if (p.startsWith('/fm')) return navigate({ name: 'fm' })
  if (p.startsWith('/contact')) return navigate({ name: 'contact' })
  if (p.startsWith('/article/')) return navigate({ name: 'article', slug: p.split('/')[2] ?? '' })
  if (p.startsWith('/rubrique/')) return navigate({ name: 'category', slug: p.split('/')[2] ?? '' })
  if (p.startsWith('/page/')) return navigate({ name: 'page', slug: p.split('/')[2] ?? '' })
  navigate({ name: 'home' })
}

/**
 * Emplacement publicitaire : créative image ou HTML personnalisé,
 * placeholder « Espace publicitaire » sinon, rien si le service échoue.
 */
export function AdSlotView({ slot, className, minHeight = 120, hideWhenEmpty = false, maxHeight, onLoaded }: AdSlotViewProps) {
  const [creative, setCreative] = useState<AdCreativePayload | null | undefined>(() => {
    const v = slotCache.get(slot)
    return v === undefined ? undefined : v
  })
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const cached = slotCache.get(slot)
    if (cached !== undefined) {
      setCreative(cached)
      setFailed(false)
      onLoaded?.(cached)
      return
    }
    let cancelled = false
    setCreative(undefined)
    api
      .get<{ creative: AdCreativePayload | null }>(`/api/ads?slot=${encodeURIComponent(slot)}`)
      .then((res) => {
        if (cancelled) return
        slotCache.set(slot, res.creative)
        setCreative(res.creative)
        setFailed(false)
        onLoaded?.(res.creative)
      })
      .catch(() => {
        // Échec NON mis en cache : réessai au prochain montage
        if (cancelled) return
        setFailed(true)
        onLoaded?.(null)
      })
    return () => {
      cancelled = true
    }
  }, [slot, onLoaded])

  // Service indisponible : on n'affiche rien du tout
  if (failed) return null

  // Mode discret (bandeau collant mobile) : rien tant que pas de créative
  if (hideWhenEmpty && creative === undefined) return null

  const trackClick = () => {
    if (!creative) return
    api.post('/api/ads/click', { creativeId: creative.id }).catch(() => {})
  }

  const isExternal = !!creative?.linkUrl && /^https?:\/\//i.test(creative.linkUrl)

  if (creative) {
    // Créative HTML libre
    if (creative.htmlCode) {
      return (
        <div
          className={cn('overflow-hidden', className)}
          style={maxHeight ? { height: maxHeight } : undefined}
          onClick={trackClick}
          data-slot={slot}
        >
          <div dangerouslySetInnerHTML={{ __html: creative.htmlCode }} />
        </div>
      )
    }
    // Créative image — hauteur réservée pour limiter le décalage de mise
    // en page ; hauteur fixe avec recadrage si maxHeight est imposé.
    const img = (
      <img
        src={creative.imageUrl ?? ''}
        alt={creative.name || 'Publicité'}
        loading="lazy"
        className={cn('w-full rounded-lg', maxHeight ? 'object-cover' : 'h-auto')}
        style={maxHeight ? { height: maxHeight } : { minHeight }}
      />
    )
    if (creative.linkUrl) {
      return (
        <a
          href={creative.linkUrl}
          target={isExternal ? '_blank' : undefined}
          rel="noopener noreferrer"
          onClick={(e) => {
            trackClick()
            if (!isExternal) {
              e.preventDefault()
              navigateFromPath(creative.linkUrl)
            }
          }}
          className={cn('block', className)}
          data-slot={slot}
        >
          {img}
        </a>
      )
    }
    return (
      <div className={cn('block cursor-pointer', className)} onClick={trackClick} data-slot={slot}>
        {img}
      </div>
    )
  }

  // Pas de créative (ou en cours de chargement) : placeholder élégant —
  // sauf en mode discret (hideWhenEmpty) où l'on n'affiche rien.
  if (hideWhenEmpty) return null
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-muted/50 px-4 text-center',
        className
      )}
      style={{ minHeight }}
      data-slot={slot}
      aria-label="Espace publicitaire"
    >
      <Megaphone className="h-5 w-5 text-muted-foreground/60" aria-hidden="true" />
      <p className="text-xs font-medium text-muted-foreground/70">Espace publicitaire</p>
      <p className="text-[11px] text-muted-foreground/50">Réserver cet emplacement</p>
    </div>
  )
}
