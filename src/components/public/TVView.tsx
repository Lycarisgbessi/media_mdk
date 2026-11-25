'use client'

// =====================================================================
// TVView — chaîne TV : bandeau EN DIRECT, grille de reportages vidéo
// en mode « facade » (vignette puis chargement du lecteur au clic, §12.2)
// =====================================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Radio, Tv, Youtube } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { formatDateTime, formatDuration, timeAgo } from '@/lib/helpers'
import type { LiveStreamPayload, VideoPayload } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContentCard } from './ContentCard'
import { AdSlotView } from './AdSlotView'

const TYPE_FILTERS = [
  { value: 'all', label: 'Tout' },
  { value: 'reportage', label: 'Reportages' },
  { value: 'replay', label: 'Replays' },
  { value: 'extrait', label: 'Extraits' },
] as const

// ---------- Bandeau du direct en cours ----------

function LiveBanner({ live }: { live: LiveStreamPayload }) {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate({ name: 'live', id: live.id })}
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-xl bg-rouge p-4 text-left text-white shadow-lg shadow-rouge/25 transition-transform hover:scale-[1.01] sm:p-5"
      aria-label={`Regarder le direct : ${live.title}`}
    >
      <span
        className="absolute inset-0 opacity-20"
        style={{ background: 'radial-gradient(circle at 20% 50%, white 0%, transparent 60%)' }}
        aria-hidden="true"
      />
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 sm:h-14 sm:w-14">
        <Play className="h-6 w-6 fill-current" aria-hidden="true" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-rouge">
          <span className="live-dot h-2 w-2 rounded-full bg-rouge" aria-hidden="true" />
          En direct maintenant
        </span>
        <span className="mt-1 block truncate text-base font-bold sm:text-lg">{live.title}</span>
        {live.description && <span className="mt-0.5 line-clamp-1 text-xs text-white/85">{live.description}</span>}
      </span>
      <span className="relative hidden shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wide sm:flex">
        Regarder
        <Play className="h-4 w-4 fill-current transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </motion.button>
  )
}

// =====================================================================
// Vue principale
// =====================================================================

export function TVView() {
  const navigate = useAppStore((s) => s.navigate)
  const settings = useAppStore((s) => s.settings)

  const [videos, setVideos] = useState<VideoPayload[] | null>(null)
  const [lives, setLives] = useState<LiveStreamPayload[]>([])
  const [filter, setFilter] = useState<string>('all')

  // ---- Chargement des vidéos et des directs ----
  useEffect(() => {
    let cancelled = false
    api
      .get<{ videos: VideoPayload[] }>('/api/videos?limit=48')
      .then((res) => {
        if (!cancelled) setVideos(Array.isArray(res.videos) ? res.videos : [])
      })
      .catch(() => {
        if (!cancelled) setVideos([])
      })
    api
      .get<{ lives: LiveStreamPayload[] }>('/api/lives')
      .then((res) => {
        if (!cancelled) setLives(Array.isArray(res.lives) ? res.lives : [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const currentLive = useMemo(() => lives.find((l) => l.status === 'live') ?? null, [lives])
  const upcoming = useMemo(() => lives.filter((l) => l.status === 'scheduled').slice(0, 2), [lives])

  const filtered = useMemo(() => {
    if (!videos) return []
    return filter === 'all' ? videos : videos.filter((v) => v.type === filter)
  }, [videos, filter])

  const [featured, ...rest] = filtered

  if (settings?.moduleTvActive === false) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <Tv className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-bold">Module TV désactivé</h1>
        <p className="text-sm text-muted-foreground">
          La chaîne vidéo est momentanément indisponible. Revenez bientôt !
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
      {/* ---- En-tête ---- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-black tracking-tight sm:text-3xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rouge text-white">
              <Tv className="h-5 w-5" aria-hidden="true" />
            </span>
            Chaîne TV
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reportages, replays et extraits — les lecteurs se chargent uniquement au clic pour préserver vos données.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate({ name: 'live' })}
          className="min-h-[44px] gap-2 rounded-full"
        >
          <Radio className="h-4 w-4 text-rouge" aria-hidden="true" />
          Tous les directs
        </Button>
      </div>

      {/* ---- Bandeau direct ---- */}
      {currentLive && (
        <div className="mt-6">
          <LiveBanner live={currentLive} />
        </div>
      )}

      {/* ---- Directs programmés ---- */}
      {upcoming.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {upcoming.map((live) => (
            <button
              key={live.id}
              type="button"
              onClick={() => navigate({ name: 'live', id: live.id })}
              className="flex min-h-[44px] items-center gap-3 rounded-lg border border-dashed border-rouge/40 bg-rouge-clair/50 px-4 py-3 text-left transition-colors hover:bg-rouge-clair dark:bg-rouge/10"
            >
              <span className="rounded-full bg-rouge px-2 py-0.5 text-[11px] font-black uppercase tracking-widest text-white">
                Prochain direct
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{live.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">Prévu le {formatDateTime(live.scheduledStart)}</span>
            </button>
          ))}
        </div>
      )}

      {/* ---- Filtres par type ---- */}
      <div className="mt-8">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList aria-label="Filtrer les vidéos par type">
            {TYPE_FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="min-h-[36px]">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* ---- Contenu ---- */}
      {videos === null ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Chargement des vidéos">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed px-6 py-16 text-center">
          <Youtube className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-semibold">Aucune vidéo pour le moment</p>
          <p className="mt-1 text-sm text-muted-foreground">Les reportages publiés apparaîtront ici.</p>
        </div>
      ) : (
        <>
          {/* Vidéo à la une : carte large */}
          <div className="mt-6">
            <ContentCard
              kind="video"
              variant="large"
              title={featured.title}
              slug={featured.id}
              imageUrl={featured.thumbnailUrl}
              category={featured.category ? { name: featured.category.name, color: featured.category.color } : null}
              meta={featured.duration ? formatDuration(featured.duration) : 'Vidéo'}
              date={featured.publishedAt || featured.createdAt}
              lede={featured.description}
            />
          </div>

          {/* Grille */}
          <div className={cn('mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3', rest.length === 0 && 'hidden')}>
            {rest.map((v) => (
              <ContentCard
                key={v.id}
                kind="video"
                title={v.title}
                slug={v.id}
                imageUrl={v.thumbnailUrl}
                category={v.category ? { name: v.category.name, color: v.category.color } : null}
                meta={v.duration ? formatDuration(v.duration) : 'Vidéo'}
                date={v.publishedAt || v.createdAt}
              />
            ))}
          </div>
        </>
      )}

      {/* ---- Publicité ---- */}
      <div className="mt-10">
        <AdSlotView slot="tv_sidebar" minHeight={120} />
      </div>
    </div>
  )
}
