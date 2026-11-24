'use client'

// =====================================================================
// LiveView — directs TV : liste (direct en cours, programmés avec compte
// à rebours, replays) et page détail pilotée par le statut (§12.3) :
// programmé → compte à rebours · en direct → lecteur + badge rouge ·
// terminé → replay · annulé → message.
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BellRing, CalendarClock, Play, Radio, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { formatDateTime, timeAgo } from '@/lib/helpers'
import { markViewed } from '@/lib/viewed'
import type { LiveStreamPayload } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ContentCard } from './ContentCard'
import { AdSlotView } from './AdSlotView'

// ---------- Compte à rebours ----------

function useCountdown(target?: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [target])
  if (!target) return null
  const diff = new Date(target).getTime() - now
  if (diff <= 0) return { over: true as const, days: 0, hours: 0, minutes: 0, seconds: 0 }
  return {
    over: false as const,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

function CountdownBox({ target }: { target: string }) {
  const cd = useCountdown(target)
  if (!cd) return null
  if (cd.over) {
    return (
      <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-jaune px-4 py-1.5 text-sm font-bold text-yellow-950">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
        Le direct démarre — actualisation…
      </p>
    )
  }
  const cells = [
    { value: cd.days, label: cd.days > 1 ? 'jours' : 'jour' },
    { value: cd.hours, label: 'h' },
    { value: cd.minutes, label: 'min' },
    { value: cd.seconds, label: 's' },
  ]
  return (
    <div className="mt-4 flex items-center gap-2" role="timer" aria-label="Compte à rebours avant le direct">
      {cells.map((c, i) => (
        <div key={i} className="flex min-w-[52px] flex-col items-center rounded-lg bg-background/70 px-2 py-1.5">
          <span className="text-lg font-black tabular-nums leading-none">{String(c.value).padStart(2, '0')}</span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- Lecteur facade (commun) ----------

function LiveFacade({ live, autoplay }: { live: LiveStreamPayload; autoplay?: boolean }) {
  const [activated, setActivated] = useState(!!autoplay)

  useEffect(() => {
    setActivated(!!autoplay)
  }, [autoplay, live.id])

  if (activated) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl shadow-lg">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${live.youtubeId}?autoplay=1&rel=0`}
          title={live.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      className="group relative block w-full overflow-hidden rounded-xl bg-gradient-to-br from-marque-fonce to-marque shadow-lg"
      aria-label={`Lire : ${live.title} (le lecteur se charge au clic)`}
    >
      <div className="aspect-video w-full">
        {live.thumbnailUrl ? (
          <img src={live.thumbnailUrl} alt={live.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-16 w-16 text-white/70" aria-hidden="true" />
          </div>
        )}
      </div>
      <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/20">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rouge text-white shadow-xl transition-transform group-hover:scale-110 sm:h-20 sm:w-20">
          <Play className="h-8 w-8 fill-current" aria-hidden="true" />
        </span>
      </span>
    </button>
  )
}

// ---------- Page détail ----------

function LiveDetail({ id }: { id: string }) {
  const navigate = useAppStore((s) => s.navigate)
  const [live, setLive] = useState<LiveStreamPayload | null>(null)
  const [loading, setLoading] = useState(true)

  // Chargement + actualisation (le statut peut évoluer pendant la session)
  const refresh = useCallback(() => {
    api
      .get<{ live: LiveStreamPayload }>(`/api/lives/${encodeURIComponent(id)}`)
      .then((res) => {
        setLive(res.live)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setLoading(true)
    refresh()
    const timer = setInterval(refresh, 30000)
    return () => clearInterval(timer)
  }, [refresh])

  // Comptage de la vue pour un direct effectivement en cours
  useEffect(() => {
    if (!live || live.status !== 'live') return
    if (!markViewed(`live:${live.id}`)) return
    api.post('/api/view', { contentType: 'live', contentId: live.id }).catch(() => {})
  }, [live])

  if (loading && !live) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6" aria-busy="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    )
  }

  if (!live) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Direct introuvable</h1>
        <p className="text-sm text-muted-foreground">Ce direct n&apos;existe pas ou a été annulé.</p>
        <Button onClick={() => navigate({ name: 'live' })} className="min-h-[44px]">
          Voir tous les directs
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <button
        type="button"
        onClick={() => navigate({ name: 'live' })}
        className="mb-4 inline-flex min-h-[36px] items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-marque"
      >
        <Radio className="h-4 w-4" aria-hidden="true" />
        Tous les directs
      </button>

      {live.status === 'live' && (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-rouge px-3.5 py-1 text-xs font-black uppercase tracking-widest text-white">
          <span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden="true" />
          En direct
        </p>
      )}

      {/* Espace publicitaire au-dessus du lecteur */}
      <div className="mb-5">
        <AdSlotView slot="live_top" minHeight={90} />
      </div>
      {live.status === 'ended' && (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-muted px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Direct terminé — Replay
        </p>
      )}

      {live.status === 'scheduled' ? (
        <div className="relative overflow-hidden rounded-xl border border-dashed border-rouge/40 bg-rouge-clair/40 dark:bg-rouge/10">
          <div className="relative aspect-video w-full">
            {live.thumbnailUrl ? (
              <img src={live.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-60 blur-[1px]" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-marque-fonce to-marque opacity-40" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <CalendarClock className="h-10 w-10 text-rouge" aria-hidden="true" />
              <h1 className="mt-3 text-xl font-black sm:text-2xl">{live.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Rendez-vous le {formatDateTime(live.scheduledStart)}
              </p>
              <CountdownBox target={live.scheduledStart ?? ''} />
              <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                Revenez à l&apos;heure du rendez-vous : le lecteur s&apos;activera automatiquement.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <LiveFacade live={live} autoplay={live.status === 'live'} />
      )}

      <h1 className={cn('mt-5 text-2xl font-black tracking-tight sm:text-3xl', live.status === 'scheduled' && 'sr-only')}>
        {live.title}
      </h1>
      {live.description && (
        <p className="mt-2 max-w-3xl leading-relaxed text-foreground/90">{live.description}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {live.status === 'ended' && <span>Terminé {timeAgo(live.actualEnd)}</span>}
        {live.status === 'live' && <span>Démarré {timeAgo(live.actualStart)}</span>}
        <span>{live.views.toLocaleString('fr-FR')} vues</span>
      </div>
    </div>
  )
}

// ---------- Liste des directs ----------

function LiveList() {
  const navigate = useAppStore((s) => s.navigate)
  const settings = useAppStore((s) => s.settings)
  const [lives, setLives] = useState<LiveStreamPayload[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ lives: LiveStreamPayload[] }>('/api/lives')
      .then((res) => {
        if (!cancelled) setLives(Array.isArray(res.lives) ? res.lives : [])
      })
      .catch(() => {
        if (!cancelled) setLives([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const current = useMemo(() => (lives ?? []).find((l) => l.status === 'live') ?? null, [lives])
  const scheduled = useMemo(() => (lives ?? []).filter((l) => l.status === 'scheduled'), [lives])
  const ended = useMemo(() => (lives ?? []).filter((l) => l.status === 'ended'), [lives])

  if (settings?.moduleTvActive === false) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <Radio className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-bold">Module TV désactivé</h1>
        <p className="text-sm text-muted-foreground">Les directs sont momentanément indisponibles.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="flex items-center gap-2.5 text-2xl font-black tracking-tight sm:text-3xl">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rouge text-white">
          <Radio className="h-5 w-5" aria-hidden="true" />
        </span>
        Directs
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Suivez nos événements en direct et retrouvez les replays.
      </p>

      {lives === null ? (
        <div className="mt-6 space-y-4" aria-busy="true">
          <Skeleton className="aspect-video w-full max-w-3xl rounded-xl" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : lives.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed px-6 py-16 text-center">
          <Radio className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-semibold">Aucun direct programmé</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Les prochains directs s&apos;afficheront ici avec un compte à rebours.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {/* ---- Direct en cours ---- */}
          {current && (
            <section aria-labelledby="current-live">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-rouge px-3.5 py-1 text-xs font-black uppercase tracking-widest text-white">
                  <span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden="true" />
                  En direct maintenant
                </div>
                <LiveFacade live={current} />
                <button
                  type="button"
                  onClick={() => navigate({ name: 'live', id: current.id })}
                  className="mt-3 text-left text-xl font-black tracking-tight transition-colors hover:text-marque sm:text-2xl"
                >
                  {current.title}
                </button>
                {current.description && (
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{current.description}</p>
                )}
              </motion.div>
            </section>
          )}

          {/* ---- Programmés ---- */}
          {scheduled.length > 0 && (
            <section aria-labelledby="scheduled-lives">
              <h2 id="scheduled-lives" className="mb-4 text-lg font-bold uppercase tracking-wide">
                Prochains directs
              </h2>
              <div className="space-y-3">
                {scheduled.map((live) => (
                  <button
                    key={live.id}
                    type="button"
                    onClick={() => navigate({ name: 'live', id: live.id })}
                    className="flex w-full flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-shadow hover:shadow-md sm:flex-row sm:items-center"
                  >
                    <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-marque-fonce to-marque sm:w-44">
                      {live.thumbnailUrl ? (
                        <img src={live.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <CalendarClock className="h-7 w-7 text-white/70" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold leading-snug">{live.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(live.scheduledStart)}</p>
                      <CountdownBox target={live.scheduledStart ?? ''} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ---- Replays ---- */}
          {ended.length > 0 && (
            <section aria-labelledby="replay-lives">
              <h2 id="replay-lives" className="mb-4 text-lg font-bold uppercase tracking-wide">
                Replays
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ended.map((live) => (
                  <ContentCard
                    key={live.id}
                    kind="video"
                    title={live.title}
                    slug={live.id}
                    imageUrl={live.thumbnailUrl}
                    meta="Replay"
                    date={live.actualEnd || live.scheduledStart}
                    onView={() => navigate({ name: 'live', id: live.id })}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export function LiveView({ id }: { id?: string }) {
  return id ? <LiveDetail id={id} /> : <LiveList />
}
