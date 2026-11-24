'use client'

// =====================================================================
// ShowView — page d'une émission FM : en-tête, grille des programmes,
// liste complète des épisodes avec lecture et partage
// =====================================================================

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarClock,
  Clock,
  Home,
  Mic,
  Play,
  Radio,
  RotateCw,
  Share2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, qs } from '@/lib/api-client'
import { formatDuration, timeAgo } from '@/lib/helpers'
import { useAppStore } from '@/lib/store'
import type { AudioContentPayload, AudioShowPayload } from '@/lib/types'
import { SharePanel } from '@/components/public/SharePanel'

function hideOnError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none'
}

export function ShowView({ slug }: { slug: string }) {
  const navigate = useAppStore((s) => s.navigate)
  const playEpisode = useAppStore((s) => s.playEpisode)
  const [show, setShow] = useState<AudioShowPayload | null>(null)
  const [episodes, setEpisodes] = useState<AudioContentPayload[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEpisodes, setLoadingEpisodes] = useState(true)
  const [error, setError] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    api
      .get<{ shows: AudioShowPayload[] }>('/api/audio-shows')
      .then((d) => {
        const found = (d.shows || []).find((s) => s.slug === slug) || null
        setShow(found)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    setLoadingEpisodes(true)
    api
      .get<{ audio: AudioContentPayload[] }>(`/api/audio${qs({ show: slug, limit: 50 })}`)
      .then((d) => {
        if (!cancelled) setEpisodes(d.audio || [])
      })
      .catch(() => {
        if (!cancelled) setEpisodes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingEpisodes(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-5 sm:flex-row">
          <Skeleton className="h-40 w-40 rounded-xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        <div className="mt-8 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !show) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rouge-clair">
          <Radio className="h-7 w-7 text-rouge" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Émission introuvable</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cette émission n&apos;existe pas ou n&apos;est plus disponible.
        </p>
        <div className="mt-5 flex gap-3">
          <Button className="rounded-full bg-marque text-white hover:bg-marque-fonce" onClick={() => navigate({ name: 'fm' })}>
            Toutes les émissions
          </Button>
          <Button variant="outline" className="rounded-full" onClick={load} disabled={loading}>
            <RotateCw className="h-4 w-4" />
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  const schedule = (show.schedule || []).filter((slot) => slot.active !== false)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* En-tête */}
        <div className="rounded-2xl border bg-card p-5 md:p-6">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-marque-fonce to-marque md:h-40 md:w-40">
              {show.coverImageUrl && (
                <img
                  src={show.coverImageUrl}
                  alt={show.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={hideOnError}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-marque">
                    <Mic className="h-3.5 w-3.5" />
                    Émission FM
                  </p>
                  <h1 className="mt-1 text-2xl font-bold leading-tight md:text-3xl">{show.name}</h1>
                  {show.hostNames && (
                    <p className="mt-1 text-sm text-muted-foreground">Avec {show.hostNames}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Partager cette émission"
                  onClick={() => setShareOpen(true)}
                  className="h-11 w-11 shrink-0 rounded-full"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
              {show.description && (
                <p className="mt-2 text-sm leading-relaxed text-foreground/85">{show.description}</p>
              )}

              {schedule.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Grille des programmes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {schedule.map((slot) => (
                      <Badge
                        key={slot.id}
                        variant="outline"
                        className="border-marque/30 bg-marque-clair px-2 py-1 text-[11px] font-medium text-marque-fonce dark:text-foreground"
                      >
                        {slot.day} · {slot.time}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Épisodes */}
        <section aria-label="Épisodes de l'émission" className="mt-8">
          <h2 className="text-lg font-bold">
            Épisodes <span className="text-sm font-normal text-muted-foreground">({episodes.length})</span>
          </h2>

          {loadingEpisodes ? (
            <div className="mt-3 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : episodes.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucun épisode publié pour le moment.
            </p>
          ) : (
            <ol className="mt-3 divide-y rounded-xl border bg-card">
              {episodes.map((episode, index) => (
                <li key={episode.id} className="flex items-center gap-3 p-3 transition hover:bg-accent/50">
                  <span className="w-8 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                    {episode.episodeNumber ? `#${episode.episodeNumber}` : index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate({ name: 'episode', slug: episode.slug })}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="line-clamp-1 block text-sm font-semibold hover:text-marque">
                      {episode.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDuration(episode.duration)}
                      <span className="hidden sm:inline">· {timeAgo(episode.publishedAt)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Lire ${episode.title}`}
                    onClick={() => playEpisode(episode, episodes)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marque text-white transition hover:scale-105 hover:bg-marque-fonce"
                  >
                    <Play className="h-4 w-4 translate-x-0.5 fill-current" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="mt-8 flex justify-center">
          <Button variant="outline" className="rounded-full" onClick={() => navigate({ name: 'home' })}>
            <Home className="h-4 w-4" />
            Retour à l&apos;accueil
          </Button>
        </div>
      </motion.div>

      <SharePanel
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={show.name}
        contentType="audio"
        contentId={show.id}
      />
    </div>
  )
}

export default ShowView
