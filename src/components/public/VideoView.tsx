'use client'

// =====================================================================
// VideoView — page vidéo : lecteur YouTube en mode facade (§12.2),
// métadonnées, transcription, partage, commentaires et vidéos liées.
// =====================================================================

import { useEffect, useState } from 'react'
import { ChevronLeft, Eye, Home, Play, Share2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { formatDate } from '@/lib/helpers'
import { markViewed } from '@/lib/viewed'
import type { VideoPayload } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Breadcrumb } from './Breadcrumb'
import { ContentCard } from './ContentCard'
import { AdSlotView } from './AdSlotView'
import { CommentsSection } from './CommentsSection'
import { SharePanel } from './SharePanel'

function VideoSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6" aria-busy="true" aria-label="Chargement de la vidéo">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="aspect-video w-full rounded-xl" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

function VideoNotFound() {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rouge-clair">
        <ChevronLeft className="h-7 w-7 text-rouge" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold">Vidéo introuvable</h1>
      <p className="text-sm text-muted-foreground">Cette vidéo n&apos;existe pas ou a été retirée.</p>
      <Button onClick={() => navigate({ name: 'tv' })} className="mt-2 min-h-[44px] gap-2">
        <Home className="h-4 w-4" aria-hidden="true" />
        Retour à la chaîne TV
      </Button>
    </div>
  )
}

// ---------- Lecteur facade : vignette puis iframe au clic ----------

function FacadePlayer({ video }: { video: VideoPayload }) {
  const [activated, setActivated] = useState(false)

  if (!activated) {
    return (
      <button
        type="button"
        onClick={() => setActivated(true)}
        className="group relative block w-full overflow-hidden rounded-xl bg-gradient-to-br from-marque-fonce to-marque shadow-lg"
        aria-label={`Lire la vidéo : ${video.title} (le lecteur YouTube se charge au clic)`}
      >
        <div className="aspect-video w-full">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Play className="h-16 w-16 text-white/70" aria-hidden="true" />
            </div>
          )}
        </div>
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/15">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rouge text-white shadow-xl transition-transform group-hover:scale-110 sm:h-20 sm:w-20">
            <Play className="h-8 w-8 fill-current" aria-hidden="true" />
          </span>
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          YouTube
        </span>
      </button>
    )
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl shadow-lg">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
        title={video.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full"
        loading="lazy"
      />
    </div>
  )
}

// =====================================================================
// Vue principale
// =====================================================================

export function VideoView({ id }: { id: string }) {
  const navigate = useAppStore((s) => s.navigate)
  const settings = useAppStore((s) => s.settings)

  const [video, setVideo] = useState<VideoPayload | null>(null)
  const [related, setRelated] = useState<VideoPayload[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setVideo(null)
    api
      .get<{ video: VideoPayload; related: VideoPayload[] }>(`/api/videos/${encodeURIComponent(id)}`)
      .then((res) => {
        if (cancelled) return
        setVideo(res.video)
        setRelated(Array.isArray(res.related) ? res.related : [])
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setNotFound(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Comptage de la vue (une seule fois par session, remplace le comptage serveur)
  useEffect(() => {
    if (!video) return
    if (!markViewed(`video:${video.id}`)) return
    api.post('/api/view', { contentType: 'video', contentId: video.id }).catch(() => {})
  }, [video])

  // SEO client : titre + JSON-LD VideoObject
  useEffect(() => {
    if (!video) return
    document.title = `${video.metaTitle || video.title} | TV`
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: video.title,
      description: video.description || video.title,
      thumbnailUrl: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
      uploadDate: video.publishedAt || video.createdAt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${video.youtubeId}`,
    }
    const el = document.getElementById('jsonld-current-view')
    el?.remove()
    const script = document.createElement('script')
    script.id = 'jsonld-current-view'
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(jsonLd)
    document.head.appendChild(script)
    return () => {
      document.getElementById('jsonld-current-view')?.remove()
    }
  }, [video])

  if (loading) return <VideoSkeleton />
  if (notFound || !video) return <VideoNotFound />

  const commentsEnabled = settings?.commentsEnabled !== false

  return (
    <div className="pb-16">
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <Breadcrumb
          items={[
            { label: 'Accueil', onClick: () => navigate({ name: 'home' }) },
            { label: 'TV', onClick: () => navigate({ name: 'tv' }) },
            { label: video.title },
          ]}
        />

        <div className="mt-5">
          <FacadePlayer video={video} />
        </div>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">{video.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {video.category && (
                <button
                  type="button"
                  onClick={() => navigate({ name: 'category', slug: video.category!.slug })}
                  className="inline-flex min-h-[28px] items-center gap-1.5 font-semibold transition-colors hover:text-marque"
                  style={{ color: video.category.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: video.category.color }} />
                  {video.category.name}
                </button>
              )}
              {video.author && (
                <button
                  type="button"
                  onClick={() => navigate({ name: 'author', id: video.author!.id })}
                  className="min-h-[28px] font-medium transition-colors hover:text-marque"
                >
                  {video.author.firstName} {video.author.lastName}
                </button>
              )}
              <span>{formatDate(video.publishedAt || video.createdAt)}</span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {video.views.toLocaleString('fr-FR')} vues
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShareOpen(true)}
            className="min-h-[44px] shrink-0 gap-1.5 rounded-full"
            aria-label="Partager cette vidéo"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Partager
          </Button>
        </div>

        {video.description && (
          <p className="mt-4 max-w-3xl leading-relaxed text-foreground/90">{video.description}</p>
        )}

        {video.transcription && (
          <Accordion type="single" collapsible className="mt-4 max-w-3xl rounded-xl border px-4">
            <AccordionItem value="transcription" className="border-0">
              <AccordionTrigger className="text-sm font-semibold">
                Transcription de la vidéo (accessibilité &amp; SEO)
              </AccordionTrigger>
              <AccordionContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {video.transcription}
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        <div className="mt-6">
          <AdSlotView slot="article_inline" minHeight={90} />
        </div>
      </div>

      {/* ---- Vidéos liées ---- */}
      {related.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6" aria-labelledby="related-videos">
          <div className="mb-4 flex items-center gap-2">
            <h2 id="related-videos" className="text-lg font-bold uppercase tracking-wide">
              À regarder aussi
            </h2>
            <span className="h-0.5 flex-1 bg-border" aria-hidden="true" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((v) => (
              <ContentCard
                key={v.id}
                kind="video"
                title={v.title}
                slug={v.id}
                imageUrl={v.thumbnailUrl}
                category={v.category ? { name: v.category.name, color: v.category.color } : null}
                date={v.publishedAt || v.createdAt}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- Commentaires ---- */}
      {commentsEnabled && (
        <section className="mx-auto max-w-3xl px-4 pt-10 sm:px-6" aria-labelledby="video-comments">
          <h2 id="video-comments" className="mb-4 text-lg font-bold uppercase tracking-wide">
            Commentaires
          </h2>
          <CommentsSection contentType="video" contentId={video.id} />
        </section>
      )}

      <SharePanel
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={video.title}
        contentType="video"
        contentId={video.id}
      />
    </div>
  )
}
