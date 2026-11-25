'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { FlashInfoPayload } from '@/lib/types'

/**
 * Bandeau rouge « FLASH » sous le header : défilement continu
 * des informations flash actives (pause au survol via .flash-marquee).
 * Recharge les flashs toutes les 30 s : un flash créé ou arrêté
 * dans le tableau de bord apparaît / disparaît sans rechargement.
 */
export function FlashBanner() {
  const navigate = useAppStore((s) => s.navigate)
  const [flash, setFlash] = useState<FlashInfoPayload[] | null>(null)

  const load = useCallback(() => {
    api
      .get<{ flash: FlashInfoPayload[] }>('/api/flash?active=1')
      .then((res) => {
        const now = Date.now()
        // Double filtre de fenêtre (sécurité si le cache d'un intermédiaire répond)
        setFlash(
          (Array.isArray(res.flash) ? res.flash : []).filter((f) => {
            if (!f.active) return false
            if (f.startsAt && new Date(f.startsAt).getTime() > now) return false
            if (f.endsAt && new Date(f.endsAt).getTime() < now) return false
            return true
          })
        )
      })
      .catch(() => {
        setFlash((prev) => prev ?? [])
      })
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 30_000)
    return () => clearInterval(timer)
  }, [load])

  // Navigation compatible avec tous les liens : ancres internes de l'appli,
  // articles/pages/rubriques, ou URL externe (nouvel onglet)
  const openLink = (link: string) => {
    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener,noreferrer')
      return
    }
    if (link.startsWith('/live')) {
      navigate({ name: 'live', id: link.split('/')[2] || undefined })
      return
    }
    if (link.startsWith('/tv')) navigate({ name: 'tv' })
    else if (link.startsWith('/fm')) navigate({ name: 'fm' })
    else if (link.startsWith('/contact')) navigate({ name: 'contact' })
    else if (link.startsWith('/rubrique/'))
      navigate({ name: 'category', slug: link.split('/')[2] ?? '' })
    else if (link.startsWith('/article/'))
      navigate({ name: 'article', slug: link.split('/')[2] ?? '' })
    else if (link.startsWith('/page/'))
      navigate({ name: 'page', slug: link.split('/')[2] ?? '' })
    else if (link.startsWith('/')) {
      // Ancre interne inconnue : navigation par chemin via l'accueil + hash
      navigate({ name: 'home' })
    }
  }

  // Rien tant que non chargé, ou si aucun flash actif
  if (!flash || flash.length === 0) return null

  // Contenu défilant répété 2× pour une boucle seamless (keyframes -50%)
  const items = [...flash, ...flash]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="overflow-hidden bg-rouge text-white"
        role="region"
        aria-label="Informations flash"
      >
        <div className="mx-auto flex max-w-7xl items-stretch">
          <div className="flex shrink-0 items-center gap-1.5 bg-black/25 px-3 py-2 text-[11px] font-black uppercase tracking-[0.2em] sm:px-4 sm:text-xs">
            <Zap className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Flash
          </div>
          <div className="relative min-w-0 flex-1 overflow-hidden py-1.5" aria-live="off">
            <div className="flash-marquee text-xs sm:text-sm">
              {items.map((f, i) => (
                <span key={`${f.id}-${i}`} className="mx-5 inline-flex items-center gap-2 sm:mx-8">
                  {f.level === 'urgent' && (
                    <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-rouge">
                      Urgent
                    </span>
                  )}
                  {f.level === 'live' && (
                    <span className="inline-flex items-center gap-1.5 rounded bg-white px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-rouge">
                      <span className="live-dot h-1.5 w-1.5 rounded-full bg-rouge" aria-hidden="true" />
                      En direct
                    </span>
                  )}
                  {f.link ? (
                    <button
                      type="button"
                      onClick={() => openLink(f.link ?? '')}
                      className={cn(
                        // py-2.5 : zone tactile confortable (≥34px) sur le bandeau défilant
                        'py-2.5 font-medium underline decoration-white/50 underline-offset-2 transition-colors hover:decoration-white',
                        f.level === 'urgent' && 'font-bold'
                      )}
                    >
                      {f.text}
                    </button>
                  ) : (
                    <span className={f.level === 'urgent' ? 'font-bold' : undefined}>{f.text}</span>
                  )}
                  <span className="ml-5 select-none opacity-60 sm:ml-8" aria-hidden="true">
                    •
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
