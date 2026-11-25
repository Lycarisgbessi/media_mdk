'use client'

// =====================================================================
// FMView — module FM (§8.5) : hero, émissions, derniers épisodes,
// filtres émission/type et lecture via le lecteur audio global
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Clock,
  Home,
  Loader2,
  Play,
  Radio,
  RotateCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, qs } from '@/lib/api-client'
import { formatDuration, timeAgo } from '@/lib/helpers'
import { useAppStore } from '@/lib/store'
import { AdSlotView } from '@/components/public/AdSlotView'
import type { AudioContentPayload, AudioSchedulePayload, AudioShowPayload } from '@/lib/types'

const TYPE_OPTIONS = [
  { value: 'podcast', label: 'Podcast' },
  { value: 'chronique', label: 'Chronique' },
  { value: 'reportage_audio', label: 'Reportage audio' },
  { value: 'episode', label: 'Épisode' },
]

function typeLabel(type: string): string {
  return TYPE_OPTIONS.find((t) => t.value === type)?.label || 'Épisode'
}

function hideOnError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none'
}

function EpisodeCard({
  episode,
  queue,
}: {
  episode: AudioContentPayload
  queue: AudioContentPayload[]
}) {
  const navigate = useAppStore((s) => s.navigate)
  const playEpisode = useAppStore((s) => s.playEpisode)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex gap-3 rounded-xl border bg-card p-3 transition hover:shadow-md"
    >
      <button
        type="button"
        onClick={() => navigate({ name: 'episode', slug: episode.slug })}
        aria-label={`Écouter ou voir ${episode.title}`}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-marque-fonce to-marque sm:h-20 sm:w-20"
      >
        {episode.coverImageUrl && (
          <img
            src={episode.coverImageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={hideOnError}
          />
        )}
      </button>

      <button
        type="button"
        onClick={() => navigate({ name: 'episode', slug: episode.slug })}
        className="min-w-0 flex-1 text-left"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-marque/40 bg-marque-clair px-1.5 py-0 text-[11px] font-semibold text-marque-fonce dark:text-foreground">
            {typeLabel(episode.type)}
          </Badge>
        </span>
        <span className="mt-1 line-clamp-2 block text-sm font-semibold leading-snug hover:text-marque">
          {episode.title}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {episode.show?.name ? `${episode.show.name} · ` : ''}
          {formatDuration(episode.duration)} · {timeAgo(episode.publishedAt)}
        </span>
      </button>

      <div className="flex shrink-0 flex-col items-center justify-center gap-1">
        <button
          type="button"
          aria-label={`Lire ${episode.title}`}
          onClick={() => playEpisode(episode, queue)}
          className="grid h-11 w-11 place-items-center rounded-full bg-marque text-white transition hover:scale-105 hover:bg-marque-fonce"
        >
          <Play className="h-4 w-4 translate-x-0.5 fill-current" />
        </button>
        <button
          type="button"
          aria-label={`Détails de ${episode.title}`}
          onClick={() => navigate({ name: 'episode', slug: episode.slug })}
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}

export function FMView() {
  const settings = useAppStore((s) => s.settings)
  const navigate = useAppStore((s) => s.navigate)

  const [shows, setShows] = useState<AudioShowPayload[]>([])
  const [episodes, setEpisodes] = useState<AudioContentPayload[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [showFilter, setShowFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  const fmDisabled = !!settings && !settings.moduleFmActive

  const loadShows = useCallback(() => {
    api
      .get<{ shows: AudioShowPayload[] }>('/api/audio-shows')
      .then((d) => setShows(d.shows || []))
      .catch(() => {})
  }, [])

  const loadEpisodes = useCallback(
    (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(false)
      api
        .get<{ audio: AudioContentPayload[]; total: number; pages: number }>(
          `/api/audio${qs({
            limit: 12,
            page: targetPage,
            show: showFilter !== 'all' ? showFilter : undefined,
            type: typeFilter !== 'all' ? typeFilter : undefined,
          })}`,
        )
        .then((d) => {
          setEpisodes((prev) => (append ? [...prev, ...(d.audio || [])] : d.audio || []))
          setTotal(d.total || 0)
          setPages(d.pages || 1)
          setPage(targetPage)
        })
        .catch(() => setError(true))
        .finally(() => {
          setLoading(false)
          setLoadingMore(false)
        })
    },
    [showFilter, typeFilter],
  )

  useEffect(() => {
    loadShows()
  }, [loadShows])

  useEffect(() => {
    loadEpisodes(1, false)
  }, [loadEpisodes])

  const schedule = useMemo(() => {
    const items: { schedule: AudioSchedulePayload; show: AudioShowPayload }[] = []
    for (const show of shows) {
      for (const slot of show.schedule || []) {
        if (slot.active !== false) items.push({ schedule: slot, show })
      }
    }
    return items.slice(0, 6)
  }, [shows])

  if (fmDisabled) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-marque-clair">
          <Radio className="h-7 w-7 text-marque-fonce dark:text-foreground" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Module FM désactivé</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le module FM est actuellement désactivé. Revenez bientôt : podcasts, chroniques et reportages audio
          reviendront dès sa réactivation.
        </p>
        <Button className="mt-5 rounded-full bg-marque text-white hover:bg-marque-fonce" onClick={() => navigate({ name: 'home' })}>
          <Home className="h-4 w-4" />
          Retour à l&apos;accueil
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-marque-fonce to-marque p-6 text-white md:p-10"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1.2px, transparent 1.2px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-jaune text-black shadow-md">
              <Radio className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight md:text-3xl">
                FM — Podcasts, chroniques &amp; reportages audio
              </h1>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                Écoutez la radio numérique de la rédaction : émissions originales, grands formats et journaux
                parlés, en continu depuis n&apos;importe quel appareil.
              </p>
            </div>
          </div>
          {schedule.length > 0 && (
            <div className="shrink-0">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/70">
                <CalendarClock className="h-3.5 w-3.5" />
                Grille des programmes
              </p>
              <div className="flex max-w-sm flex-wrap gap-1.5">
                {schedule.map((item) => (
                  <Badge
                    key={item.schedule.id}
                    variant="outline"
                    className="border-white/30 bg-white/10 px-2 py-1 text-[11px] font-medium text-white"
                  >
                    {item.schedule.day.slice(0, 3)}. {item.schedule.time} · {item.show.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* Émissions */}
      <section aria-label="Nos émissions" className="mt-8">
        <h2 className="text-lg font-bold">Nos émissions</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {loading && shows.length === 0
            ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)
            : shows.map((show) => (
                <motion.button
                  key={show.id}
                  type="button"
                  whileHover={{ y: -3 }}
                  onClick={() => navigate({ name: 'show', slug: show.slug })}
                  className="group overflow-hidden rounded-xl border bg-card text-left transition hover:shadow-lg"
                >
                  <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-marque-fonce to-marque">
                    {show.coverImageUrl && (
                      <img
                        src={show.coverImageUrl}
                        alt={show.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        onError={hideOnError}
                      />
                    )}
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                      {show._count?.contents ?? 0} épisode{(show._count?.contents ?? 0) > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-bold group-hover:text-marque">{show.name}</p>
                    {show.hostNames && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">Avec {show.hostNames}</p>
                    )}
                  </div>
                </motion.button>
              ))}
        </div>
      </section>

      {/* Derniers épisodes */}
      <section aria-label="Derniers épisodes" className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold">
            Derniers épisodes <span className="text-sm font-normal text-muted-foreground">({total})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Select value={showFilter} onValueChange={setShowFilter}>
              <SelectTrigger className="min-h-[44px] w-full sm:w-52" aria-label="Filtrer par émission">
                <SelectValue placeholder="Toutes les émissions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les émissions</SelectItem>
                {shows.map((show) => (
                  <SelectItem key={show.id} value={show.slug}>
                    {show.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="min-h-[44px] w-full sm:w-44" aria-label="Filtrer par type">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">Impossible de charger les épisodes.</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => loadEpisodes(1, false)}>
              <RotateCw className="h-4 w-4" />
              Réessayer
            </Button>
          </div>
        ) : episodes.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucun épisode ne correspond à ces filtres.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {episodes.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} queue={episodes} />
            ))}
          </div>
        )}

        {!loading && !error && page < pages && (
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              className="min-h-[44px] rounded-full"
              disabled={loadingMore}
              onClick={() => loadEpisodes(page + 1, true)}
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Charger plus
            </Button>
          </div>
        )}
      </section>

      {/* Rappel du temps d'écoute cumulé (info légère) */}
      {episodes.length > 0 && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {total} épisode{total > 1 ? 's' : ''} au catalogue ·{' '}
          {formatDuration(episodes.reduce((acc, e) => acc + (e.duration || 0), 0))} d&apos;écoute sur cette page
        </p>
      )}
      {/* ---- Publicité ---- */}
      <div className="mt-10">
        <AdSlotView slot="fm_sidebar" minHeight={120} />
      </div>
    </div>
  )
}

export default FMView
