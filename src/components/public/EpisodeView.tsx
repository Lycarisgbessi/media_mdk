'use client'

// =====================================================================
// EpisodeView — page d'un épisode audio : grande vignette, bouton
// « Écouter », description, transcription, partage, commentaires et
// playlist « À écouter ensuite »
// =====================================================================

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Cloud,
  Clock,
  FileText,
  Play,
  RotateCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { formatDuration, formatDate, markdownToHtml, timeAgo } from '@/lib/helpers'
import { markViewed } from '@/lib/viewed'
import { useAppStore } from '@/lib/store'
import type { AudioContentPayload } from '@/lib/types'
import { SharePanel } from '@/components/public/SharePanel'
import { CommentsSection } from '@/components/public/CommentsSection'

function typeLabel(type: string): string {
  switch (type) {
    case 'podcast':
      return 'Podcast'
    case 'chronique':
      return 'Chronique'
    case 'reportage_audio':
      return 'Reportage audio'
    default:
      return 'Épisode'
  }
}

function hideOnError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = 'none'
}

export function EpisodeView({ slug }: { slug: string }) {
  const settings = useAppStore((s) => s.settings)
  const navigate = useAppStore((s) => s.navigate)
  const playEpisode = useAppStore((s) => s.playEpisode)
  const playerEpisodeId = useAppStore((s) => s.playerEpisode?.id ?? null)

  const [audio, setAudio] = useState<AudioContentPayload | null>(null)
  const [playlist, setPlaylist] = useState<AudioContentPayload[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    api
      .get<{ audio: AudioContentPayload; playlist: AudioContentPayload[] }>(
        `/api/audio/${encodeURIComponent(slug)}`,
      )
      .then((d) => {
        setAudio(d.audio)
        setPlaylist(d.playlist || [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  // Journalisation de la vue (fire-and-forget, une seule fois par session)
  useEffect(() => {
    if (!audio) return
    if (!markViewed(`audio:${audio.id}`)) return
    api.post('/api/view', { contentType: 'audio', contentId: audio.id }).catch(() => {})
  }, [audio])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <Skeleton className="aspect-video w-full max-w-2xl rounded-xl" />
        <Skeleton className="mt-5 h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-48" />
        <Skeleton className="mt-6 h-14 w-56 rounded-full" />
        <div className="mt-8 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !audio) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rouge-clair">
          <Cloud className="h-7 w-7 text-rouge" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Épisode introuvable</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cet épisode n&apos;existe pas ou n&apos;est plus disponible.
        </p>
        <div className="mt-5 flex gap-3">
          <Button className="rounded-full bg-marque text-white hover:bg-marque-fonce" onClick={() => navigate({ name: 'fm' })}>
            Aller au module FM
          </Button>
          <Button variant="outline" className="rounded-full" onClick={load} disabled={loading}>
            <RotateCw className="h-4 w-4" />
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Fil d'Ariane */}
        <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <button type="button" className="min-h-[32px] hover:text-marque" onClick={() => navigate({ name: 'home' })}>
            Accueil
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <button type="button" className="min-h-[32px] hover:text-marque" onClick={() => navigate({ name: 'fm' })}>
            FM
          </button>
          {audio.show && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <button
                type="button"
                className="min-h-[32px] truncate hover:text-marque"
                onClick={() => navigate({ name: 'show', slug: audio.show!.slug })}
              >
                {audio.show.name}
              </button>
            </>
          )}
        </nav>

        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Colonne principale */}
          <article className="min-w-0">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-marque-fonce to-marque">
              {audio.coverImageUrl && (
                <img
                  src={audio.coverImageUrl}
                  alt={audio.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={hideOnError}
                />
              )}
              <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                {typeLabel(audio.type)}
              </span>
            </div>

            <h1 className="mt-5 text-2xl font-bold leading-tight md:text-3xl">{audio.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {audio.show && (
                <button
                  type="button"
                  onClick={() => navigate({ name: 'show', slug: audio.show!.slug })}
                  className="rounded-full border border-marque/30 bg-marque-clair px-3 py-1 text-xs font-semibold text-marque-fonce transition hover:bg-marque hover:text-white dark:text-foreground"
                >
                  {audio.show.name}
                </button>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(audio.publishedAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(audio.duration)}
              </span>
              <span>{timeAgo(audio.publishedAt)}</span>
            </div>

            {/* Lecture */}
            <div className="mt-6 flex flex-col items-start gap-2">
              <Button
                onClick={() => playEpisode(audio, playlist)}
                className="h-14 rounded-full bg-marque px-8 text-base font-semibold text-white shadow-md hover:bg-marque-fonce"
              >
                <Play className="h-5 w-5 fill-current" />
                Écouter
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Cloud className="h-3.5 w-3.5" />
                Le fichier est diffusé en continu depuis Google Drive
              </p>
            </div>

            {audio.description && (
              <div
                className="article-body mt-6"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(audio.description) }}
              />
            )}

            {/* Transcription */}
            {audio.transcription && (
              <aside
                aria-label="Transcription"
                className="mt-6 rounded-xl bg-jaune-clair p-4 dark:bg-jaune-clair md:p-6"
              >
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                  <FileText className="h-4 w-4" />
                  Transcription
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                  {audio.transcription}
                </p>
              </aside>
            )}

            {/* Partage */}
            <div className="mt-6">
              <Button variant="outline" className="rounded-full" onClick={() => setShareOpen(true)}>
                Partager cet épisode
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {settings?.commentsEnabled !== false && (
              <CommentsSection key={audio.id} contentType="audio" contentId={audio.id} />
            )}
          </article>

          {/* Playlist */}
          <aside aria-label="À écouter ensuite" className="lg:border-l lg:pl-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              À écouter ensuite
            </h2>
            {playlist.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Aucun autre épisode dans cette émission pour l&apos;instant.
              </p>
            ) : (
              <ul className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1 scroll-slim">
                {playlist.map((ep) => {
                  const isCurrent = playerEpisodeId === ep.id
                  return (
                    <li key={ep.id}>
                      <div
                        className={`flex items-center gap-3 rounded-xl border p-2 transition ${
                          isCurrent
                            ? 'border-marque bg-marque-clair/60 dark:bg-marque-clair'
                            : 'bg-card hover:bg-accent/60'
                        }`}
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-marque-fonce to-marque">
                          {ep.coverImageUrl && (
                            <img
                              src={ep.coverImageUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                              onError={hideOnError}
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate({ name: 'episode', slug: ep.slug })}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span
                            className={`line-clamp-2 block text-sm font-medium leading-snug ${isCurrent ? 'text-marque-fonce dark:text-marque' : ''}`}
                          >
                            {ep.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {formatDuration(ep.duration)}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Lire ${ep.title}`}
                          onClick={() =>
                            playEpisode(ep, playlist.filter((p) => p.id !== ep.id))
                          }
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:scale-105 ${
                            isCurrent
                              ? 'bg-marque text-white'
                              : 'bg-secondary text-foreground hover:bg-marque hover:text-white'
                          }`}
                        >
                          {isCurrent ? (
                            <Play className="h-3.5 w-3.5 fill-current" />
                          ) : (
                            <Play className="h-3.5 w-3.5 translate-x-0.5 fill-current" />
                          )}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>
        </div>
      </motion.div>

      <SharePanel
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={audio.title}
        contentType="audio"
        contentId={audio.id}
      />
    </div>
  )
}

export default EpisodeView
