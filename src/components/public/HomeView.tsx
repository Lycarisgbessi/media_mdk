'use client'

import { Fragment, useEffect, useState } from 'react'
import {
  ArrowRight,
  Headphones,
  Loader2,
  Megaphone,
  Play,
  Radio,
  RefreshCw,
  Tv,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { api, qs } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { formatDuration, timeAgo } from '@/lib/helpers'
import type {
  ArticlePayload,
  AudioContentPayload,
  HomepageBlockItem,
  LiveStreamPayload,
  VideoPayload,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ContentCard } from '@/components/public/ContentCard'
import { FeaturedBlock } from '@/components/public/FeaturedBlock'
import { MostReadBlock } from '@/components/public/MostReadBlock'
import { AdSlotView } from '@/components/public/AdSlotView'

// ---------- Types internes ----------
interface HomeData {
  featured: ArticlePayload[]
  latest: ArticlePayload[]
  latestPages: number
  audio: AudioContentPayload[]
  videos: VideoPayload[]
  mostRead: ArticlePayload[]
  lives: LiveStreamPayload[]
}

const FALLBACK_BLOCKS: HomepageBlockItem[] = [
  { id: 'b-featured', type: 'featured', title: 'À la une', order: 1, active: true },
  { id: 'b-latest', type: 'latest', title: 'Dernières actualités', order: 2, active: true },
  { id: 'b-ads', type: 'ads', title: 'Publicité', source: 'home_top', order: 3, active: true },
  { id: 'b-fm', type: 'fm', title: 'Podcasts FM', order: 4, active: true },
  { id: 'b-tv', type: 'tv', title: 'Vidéos TV', order: 5, active: true },
  { id: 'b-most', type: 'most_read', title: 'Les plus consultés', order: 6, active: true },
  { id: 'b-social', type: 'social', title: 'Réseaux sociaux', order: 8, active: true },
]

const BLOCK_DEFAULT_TITLES: Record<string, string> = {
  featured: 'À la une',
  latest: 'Dernières actualités',
  fm: 'Podcasts FM',
  tv: 'Vidéos TV',
  most_read: 'Les plus consultés',
  social: 'Réseaux sociaux',
}

// ---------- Titre de section avec barre d'accent ----------
function SectionTitle({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
      <h2 className="flex items-center gap-3 text-lg font-bold uppercase tracking-wide sm:text-xl">
        <span className="h-6 w-1 shrink-0 rounded-full bg-marque" aria-hidden="true" />
        {title}
      </h2>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="group inline-flex min-h-[44px] items-center gap-1 rounded-md px-1 text-sm font-semibold text-marque transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-marque"
        >
          {action.label}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

// ---------- Bloc « Rubrique » : derniers articles d'une rubrique ----------
function CategoryLatestBlock({ slug, title }: { slug: string; title?: string | null }) {
  const navigate = useAppStore((s) => s.navigate)
  const [articles, setArticles] = useState<ArticlePayload[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ articles: ArticlePayload[] }>(`/api/articles?category=${encodeURIComponent(slug)}&limit=4`)
      .then((res) => {
        if (!cancelled) setArticles(res.articles ?? [])
      })
      .catch(() => {
        if (!cancelled) setArticles([])
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (!articles || articles.length === 0) return null
  const heading = title || articles[0]?.category?.name || 'Rubrique'
  return (
    <section aria-label={heading}>
      <SectionTitle
        title={heading}
        action={{ label: 'Voir la rubrique', onClick: () => navigate({ name: 'category', slug }) }}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {articles.map((a) => (
          <ContentCard
            key={a.id}
            kind="article"
            title={a.title}
            slug={a.slug}
            imageUrl={a.coverImageUrl}
            category={a.category ? { name: a.category.name, color: a.category.color } : null}
            meta={`${a.readingTime} min de lecture`}
            date={a.publishedAt || a.createdAt}
          />
        ))}
      </div>
    </section>
  )
}

// ---------- Carte épisode FM (horizontale, vignette carrée) ----------
function EpisodeCard({ episode, queue }: { episode: AudioContentPayload; queue: AudioContentPayload[] }) {
  const navigate = useAppStore((s) => s.navigate)
  const playEpisode = useAppStore((s) => s.playEpisode)
  const [imgOk, setImgOk] = useState(true)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm ring-1 ring-border/60"
    >
      <button
        type="button"
        onClick={() => navigate({ name: 'episode', slug: episode.slug })}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-marque-fonce to-marque focus-visible:outline-2 focus-visible:outline-marque"
        aria-label={`Écouter : ${episode.title}`}
      >
        {episode.coverImageUrl && imgOk ? (
          <img
            src={episode.coverImageUrl}
            alt={episode.title}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <Headphones className="h-6 w-6 text-white/70" aria-hidden="true" />
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => navigate({ name: 'episode', slug: episode.slug })}
          className="block w-full text-left focus-visible:outline-2 focus-visible:outline-marque"
        >
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug underline-offset-2 hover:underline">
            {episode.title}
          </h3>
        </button>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {episode.show?.name || episode.category?.name || 'Podcast'} · {formatDuration(episode.duration)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => playEpisode(episode, queue)}
        aria-label={`Lire l'épisode : ${episode.title}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-marque text-white shadow-md shadow-marque/30 transition-all hover:scale-105 hover:bg-marque-fonce focus-visible:outline-2 focus-visible:outline-marque"
      >
        <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />
      </button>
    </motion.div>
  )
}

// ---------- Carte vidéo TV (vignette YouTube) ----------
function VideoCard({ video }: { video: VideoPayload }) {
  const navigate = useAppStore((s) => s.navigate)
  const [imgOk, setImgOk] = useState(true)
  const thumbnail = video.thumbnailUrl || (video.youtubeId ? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg` : null)

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`Regarder : ${video.title}`}
      onClick={() => navigate({ name: 'video', id: video.id })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate({ name: 'video', id: video.id })
        }
      }}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      className="group cursor-pointer overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/60 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-marque"
    >
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-rouge/70 to-marque-fonce">
        {thumbnail && imgOk ? (
          <img
            src={thumbnail}
            alt={video.title}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <Tv className="h-8 w-8 text-white/60" aria-hidden="true" />
          </span>
        )}
        <span
          className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-80 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rouge text-white shadow-lg transition-transform group-hover:scale-110">
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </span>
        </span>
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug underline-offset-2 group-hover:underline">
          {video.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {video.category?.name ? `${video.category.name} · ` : ''}
          {timeAgo(video.publishedAt || video.createdAt)}
        </p>
      </div>
    </motion.div>
  )
}

// ---------- Bandeau direct au-dessus du bloc TV ----------
function LiveBanner({ live }: { live: LiveStreamPayload }) {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate({ name: 'live', id: live.id })}
      className="mb-4 flex min-h-[48px] w-full items-center gap-3 rounded-xl bg-rouge px-4 py-2.5 text-left text-white shadow-md shadow-rouge/30 transition-colors hover:bg-rouge/90 focus-visible:outline-2 focus-visible:outline-rouge"
      aria-label="Suivre le direct"
    >
      <span className="live-dot h-2.5 w-2.5 shrink-0 rounded-full bg-white" aria-hidden="true" />
      <span className="shrink-0 text-xs font-black uppercase tracking-widest">En direct</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{live.title}</span>
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </motion.button>
  )
}

// ---------- Rangée réseaux sociaux ----------
function SocialRow() {
  const socialLinks = useAppStore((s) => s.socialLinks)
  if (!socialLinks.length) return null
  return (
    <section className="rounded-2xl border bg-card p-6">
      <SectionTitle title="Suivez-nous" />
      <div className="flex flex-wrap gap-3">
        {socialLinks.filter((s) => s.active).map((s) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.platform}
            className="flex h-11 items-center gap-2 rounded-full border bg-muted/50 px-4 text-sm font-medium text-muted-foreground transition-colors hover:border-marque hover:text-marque"
          >
            <Megaphone className="h-4 w-4" aria-hidden="true" />
            {s.platform}
          </a>
        ))}
      </div>
    </section>
  )
}

// ---------- Squelette de chargement ----------
function HomeSkeleton() {
  return (
    <div className="space-y-10" aria-hidden="true">
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Skeleton className="min-h-[320px] rounded-xl lg:col-span-2" />
        <div className="flex flex-col gap-4 lg:gap-6">
          <Skeleton className="h-[150px] rounded-xl" />
          <Skeleton className="h-[150px] rounded-xl" />
        </div>
      </div>
      <div>
        <Skeleton className="mb-5 h-7 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  )
}

// ---------- Vue d'accueil (§8.2) ----------
export function HomeView() {
  const navigate = useAppStore((s) => s.navigate)
  const homepageBlocks = useAppStore((s) => s.homepageBlocks)
  const settings = useAppStore((s) => s.settings)

  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)

  // « Dernières actualités » — pagination append
  const [moreArticles, setMoreArticles] = useState<ArticlePayload[]>([])
  const [morePage, setMorePage] = useState(1)
  const [morePages, setMorePages] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)

  const fmActive = settings?.moduleFmActive ?? true
  const tvActive = settings?.moduleTvActive ?? true

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    const safe = <T,>(p: Promise<T>, fallback: T): Promise<T> =>
      p.catch(() => fallback)

    Promise.all([
      safe(
        api.get<{ articles: ArticlePayload[] }>('/api/articles?featured=1&limit=5').then((r) => r.articles),
        [] as ArticlePayload[]
      ),
      safe(
        api.get<{ articles: ArticlePayload[]; pages: number }>('/api/articles?limit=9&page=1'),
        { articles: [] as ArticlePayload[], pages: 1 }
      ),
      safe(
        api.get<{ audio: AudioContentPayload[] }>(`/api/audio${qs({ limit: 4 })}`).then((r) => r.audio),
        [] as AudioContentPayload[]
      ),
      safe(
        api.get<{ videos: VideoPayload[] }>(`/api/videos${qs({ limit: 4 })}`).then((r) => r.videos),
        [] as VideoPayload[]
      ),
      safe(
        api.get<{ articles: ArticlePayload[] }>(`/api/articles${qs({ order: 'views', limit: 6 })}`).then((r) => r.articles),
        [] as ArticlePayload[]
      ),
      safe(
        api.get<{ lives: LiveStreamPayload[] }>('/api/lives').then((r) => r.lives ?? []),
        [] as LiveStreamPayload[]
      ),
    ])
      .then(([featured, latest, audio, videos, mostRead, lives]) => {
        if (cancelled) return
        setData({
          featured,
          latest: latest.articles,
          latestPages: latest.pages ?? 1,
          audio,
          videos,
          mostRead,
          lives,
        })
        setMoreArticles([])
        setMorePage(1)
        setMorePages(latest.pages ?? 1)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reload])

  const loadMore = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const res = await api.get<{ articles: ArticlePayload[]; page: number; pages: number }>(
        `/api/articles${qs({ limit: 9, page: morePage + 1 })}`
      )
      setMoreArticles((prev) => [...prev, ...res.articles])
      setMorePage(res.page)
      setMorePages(res.pages)
    } catch {
      // silencieux : le bouton reste disponible
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <HomeSkeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-20 text-center lg:px-6">
        <p className="text-lg font-semibold">Impossible de charger la page d'accueil</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Vérifiez votre connexion, puis relancez le chargement du contenu éditorial.
        </p>
        <Button onClick={() => setReload((n) => n + 1)} className="gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Réessayer
        </Button>
      </div>
    )
  }

  const allLatest = [...data.latest, ...moreArticles]
  const hasMore = morePage < morePages
  const activeLive = data.lives.find((l) => l.status === 'live')
  const blocks = (homepageBlocks.filter((b) => b.active).length
    ? homepageBlocks.filter((b) => b.active)
    : FALLBACK_BLOCKS
  ).sort((a, b) => a.order - b.order)

  const renderBlock = (block: HomepageBlockItem) => {
    switch (block.type) {
      case 'flash':
        // déjà affiché sous le header par AppShell
        return null

      case 'featured':
        if (!data.featured.length) return null
        return (
          <section key={block.id} aria-label={block.title || BLOCK_DEFAULT_TITLES.featured}>
            <SectionTitle title={block.title || BLOCK_DEFAULT_TITLES.featured} />
            <FeaturedBlock articles={data.featured} />
          </section>
        )

      case 'ads':
        if (block.source !== 'home_top') return null
        return (
          <section key={block.id} aria-label="Publicité">
            <AdSlotView slot="home_top" minHeight={120} />
          </section>
        )

      case 'latest':
        if (!data.latest.length) return null
        return (
          <section key={block.id} aria-label={block.title || BLOCK_DEFAULT_TITLES.latest}>
            <SectionTitle title={block.title || BLOCK_DEFAULT_TITLES.latest} />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allLatest.map((a) => (
                <ContentCard
                  key={a.id}
                  kind="article"
                  title={a.title}
                  slug={a.slug}
                  imageUrl={a.coverImageUrl}
                  category={a.category ? { name: a.category.name, color: a.category.color } : null}
                  meta={`${a.readingTime} min de lecture`}
                  date={a.publishedAt || a.createdAt}
                />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="min-h-[44px] gap-2 rounded-full px-6"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Chargement…
                    </>
                  ) : (
                    'Plus d\'articles'
                  )}
                </Button>
              </div>
            )}
          </section>
        )

      case 'fm': {
        if (!fmActive || !data.audio.length) return null
        return (
          <section key={block.id} aria-label={block.title || BLOCK_DEFAULT_TITLES.fm}>
            <div className="rounded-2xl bg-marque-clair p-4 dark:bg-marque-clair sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-jaune text-black shadow-sm" aria-hidden="true">
                    <Radio className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold uppercase tracking-wide sm:text-xl">
                      {block.title || BLOCK_DEFAULT_TITLES.fm}
                    </h2>
                    <p className="text-xs text-muted-foreground">Écoutez nos dernières émissions où vous voulez</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'fm' })}
                  className="group inline-flex min-h-[44px] items-center gap-1 rounded-md px-1 text-sm font-semibold text-marque hover:underline focus-visible:outline-2 focus-visible:outline-marque"
                >
                  Tout le FM
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {data.audio.map((ep) => (
                  <EpisodeCard key={ep.id} episode={ep} queue={data.audio} />
                ))}
              </div>
            </div>
          </section>
        )
      }

      case 'tv': {
        if (!tvActive || !data.videos.length) return null
        return (
          <section key={block.id} aria-label={block.title || BLOCK_DEFAULT_TITLES.tv}>
            {activeLive && <LiveBanner live={activeLive} />}
            <div className="rounded-2xl border bg-card p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rouge text-white shadow-sm" aria-hidden="true">
                    <Tv className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold uppercase tracking-wide sm:text-xl">
                      {block.title || BLOCK_DEFAULT_TITLES.tv}
                    </h2>
                    <p className="text-xs text-muted-foreground">Reportages, replays et extraits de la rédaction</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'tv' })}
                  className="group inline-flex min-h-[44px] items-center gap-1 rounded-md px-1 text-sm font-semibold text-marque hover:underline focus-visible:outline-2 focus-visible:outline-marque"
                >
                  Tout le TV
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {data.videos.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            </div>
          </section>
        )
      }

      case 'most_read':
        if (!data.mostRead.length) return null
        return (
          <section key={block.id} aria-label={block.title || BLOCK_DEFAULT_TITLES.most_read}>
            <SectionTitle title={block.title || BLOCK_DEFAULT_TITLES.most_read} />
            <div className="lg:grid lg:grid-cols-3 lg:gap-6">
              <div className="lg:col-span-2">
                <div className="grid gap-4 md:grid-cols-2">
                  {data.mostRead.slice(0, 4).map((a) => (
                    <ContentCard
                      key={a.id}
                      kind="article"
                      variant="horizontal"
                      title={a.title}
                      slug={a.slug}
                      imageUrl={a.coverImageUrl}
                      category={a.category ? { name: a.category.name, color: a.category.color } : null}
                      meta={`${a.readingTime} min de lecture`}
                      date={a.publishedAt || a.createdAt}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-4 lg:col-span-1 lg:mt-0">
                <MostReadBlock articles={data.mostRead} />
              </div>
            </div>
          </section>
        )

      case 'social':
        return <div key={block.id}><SocialRow /></div>

      case 'category':
        // Derniers articles de la rubrique choisie (block.source = slug)
        if (!block.source) return null
        return <CategoryLatestBlock key={block.id} slug={block.source} title={block.title} />

      default:
        return null
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      {/* Espaces publicitaires intercalés : home_mid au milieu des blocs,
          home_bottom en fin de page (home_top passe par le bloc « ads »). */}
      <div className={cn('space-y-10 sm:space-y-12')}>
        {blocks.map((block, i) => (
          <Fragment key={block.id}>
            {renderBlock(block)}
            {i === Math.floor((blocks.length - 1) / 2) && i < blocks.length - 1 ? (
              <AdSlotView slot="home_mid" minHeight={110} />
            ) : null}
            {i === blocks.length - 1 ? <AdSlotView slot="home_bottom" minHeight={110} /> : null}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
