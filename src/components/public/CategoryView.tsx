'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Brain,
  Cpu,
  Earth,
  FolderOpen,
  Globe,
  GraduationCap,
  Headphones,
  HeartPulse,
  Landmark,
  Loader2,
  MicVocal,
  Newspaper,
  Palette,
  Play,
  Scale,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { api, qs } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { formatDuration, timeAgo } from '@/lib/helpers'
import type {
  ArticlePayload,
  AudioContentPayload,
  CategoryPayload,
  VideoPayload,
} from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumb } from '@/components/public/Breadcrumb'
import { ContentCard } from '@/components/public/ContentCard'
import { MostReadBlock } from '@/components/public/MostReadBlock'
import { AdSlotView } from '@/components/public/AdSlotView'

// ---------- Icônes de rubriques ----------
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Newspaper,
  Globe,
  AlertTriangle,
  Scale,
  Earth,
  Landmark,
  Users,
  TrendingUp,
  Palette,
  Trophy,
  GraduationCap,
  HeartPulse,
  Cpu,
  MicVocal,
  Brain,
  FolderOpen,
}

function categoryIcon(name?: string | null): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || FolderOpen
}

/** Texte blanc ou noir selon la luminance de la couleur de rubrique. */
function contrastText(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim())
  if (!m) return '#FFFFFF'
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#14181A' : '#FFFFFF'
}

function flattenCategories(list: CategoryPayload[]): CategoryPayload[] {
  const out: CategoryPayload[] = []
  const walk = (items: CategoryPayload[]) => {
    for (const c of items) {
      out.push(c)
      if (c.children?.length) walk(c.children)
    }
  }
  walk(list)
  return out
}

// ---------- Ligne audio avec lecture directe ----------
function AudioRow({ episode, queue }: { episode: AudioContentPayload; queue: AudioContentPayload[] }) {
  const navigate = useAppStore((s) => s.navigate)
  const playEpisode = useAppStore((s) => s.playEpisode)
  const [imgOk, setImgOk] = useState(true)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-marque/40"
    >
      <button
        type="button"
        onClick={() => navigate({ name: 'episode', slug: episode.slug })}
        className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-marque-fonce to-marque focus-visible:outline-2 focus-visible:outline-marque sm:h-[72px] sm:w-32"
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
      <button
        type="button"
        onClick={() => navigate({ name: 'episode', slug: episode.slug })}
        className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-marque"
      >
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug underline-offset-2 hover:underline">
          {episode.title}
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {episode.show?.name || episode.category?.name || 'Podcast'} · {formatDuration(episode.duration)}
          {episode.publishedAt ? ` · ${timeAgo(episode.publishedAt)}` : ''}
        </p>
      </button>
      <button
        type="button"
        onClick={() => playEpisode(episode, queue)}
        aria-label={`Lire l'épisode : ${episode.title}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-marque text-white shadow-md shadow-marque/25 transition-all hover:scale-105 hover:bg-marque-fonce focus-visible:outline-2 focus-visible:outline-marque"
      >
        <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden="true" />
      </button>
    </motion.div>
  )
}

// ---------- Squelette ----------
function CategorySkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="mx-4 mt-4 h-4 w-40" />
      <Skeleton className="mt-4 h-32 rounded-none sm:h-36" />
      <Skeleton className="mt-2 h-12 rounded-none" />
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:grid lg:grid-cols-3 lg:gap-8">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 space-y-4 lg:col-span-1 lg:mt-0">
          <Skeleton className="h-[250px] rounded-lg" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

type Mode = 'all' | 'articles' | 'audio' | 'video'

/**
 * Page rubrique : bandeau coloré, filtres (type / tri / sous-rubrique),
 * grille mixte articles + FM + TV, sidebar pub + top lecture.
 */
export function CategoryView({ slug }: { slug: string }) {
  const navigate = useAppStore((s) => s.navigate)
  const settings = useAppStore((s) => s.settings)
  const fmActive = settings?.moduleFmActive ?? true
  const tvActive = settings?.moduleTvActive ?? true

  // Résolution de la rubrique
  const [tree, setTree] = useState<CategoryPayload[] | null>(null)
  const [treeError, setTreeError] = useState(false)
  const [reload, setReload] = useState(0)

  const cat = useMemo(() => {
    if (!tree) return null
    return flattenCategories(tree).find((c) => c.slug === slug) ?? null
  }, [tree, slug])
  const children = cat?.children ?? []

  // Filtres
  const [mode, setMode] = useState<Mode>('all')
  const [order, setOrder] = useState<'recent' | 'views'>('recent')
  const [subSlug, setSubSlug] = useState('all')
  const activeSlug = subSlug === 'all' ? slug : subSlug

  // Articles paginés
  const [articles, setArticles] = useState<ArticlePayload[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [articlesLoading, setArticlesLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Médias de la rubrique + top lecture
  const [audio, setAudio] = useState<AudioContentPayload[]>([])
  const [videos, setVideos] = useState<VideoPayload[]>([])
  const [topArticles, setTopArticles] = useState<ArticlePayload[]>([])
  const [mediaLoading, setMediaLoading] = useState(true)

  // Arbre des rubriques
  useEffect(() => {
    let cancelled = false
    setTreeError(false)
    api
      .get<{ categories: CategoryPayload[] }>('/api/categories')
      .then((res) => {
        if (!cancelled) setTree(Array.isArray(res.categories) ? res.categories : [])
      })
      .catch(() => {
        if (!cancelled) setTreeError(true)
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  // Réinitialisation des filtres à chaque changement de rubrique
  useEffect(() => {
    setMode('all')
    setOrder('recent')
    setSubSlug('all')
  }, [slug])

  // Articles (filtre sous-rubrique + tri)
  useEffect(() => {
    if (!cat) return
    let cancelled = false
    setArticlesLoading(true)
    api
      .get<{ articles: ArticlePayload[]; page: number; pages: number; total: number }>(
        `/api/articles${qs({ category: activeSlug, order, page: 1, limit: 12 })}`
      )
      .then((res) => {
        if (cancelled) return
        setArticles(res.articles)
        setPage(res.page)
        setPages(res.pages)
        setTotal(res.total)
      })
      .catch(() => {
        if (!cancelled) setArticles([])
      })
      .finally(() => {
        if (!cancelled) setArticlesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cat, activeSlug, order])

  // Médias de la rubrique + les plus consultés
  useEffect(() => {
    if (!cat) return
    let cancelled = false
    setMediaLoading(true)
    const requests: Promise<void>[] = [
      api
        .get<{ articles: ArticlePayload[] }>(`/api/articles${qs({ category: slug, order: 'views', limit: 5 })}`)
        .then((res) => {
          if (!cancelled) setTopArticles(res.articles)
        })
        .catch(() => {}),
    ]
    if (fmActive) {
      requests.push(
        api
          .get<{ audio: AudioContentPayload[] }>(`/api/audio${qs({ category: slug, limit: 6 })}`)
          .then((res) => {
            if (!cancelled) setAudio(res.audio)
          })
          .catch(() => {})
      )
    }
    if (tvActive) {
      requests.push(
        api
          .get<{ videos: VideoPayload[] }>(`/api/videos${qs({ category: slug, limit: 6 })}`)
          .then((res) => {
            if (!cancelled) setVideos(res.videos)
          })
          .catch(() => {})
      )
    }
    Promise.all(requests).finally(() => {
      if (!cancelled) setMediaLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [cat, slug, fmActive, tvActive])

  // Si le mode actif devient indisponible, retour à « Tous »
  useEffect(() => {
    if (mode === 'audio' && (!fmActive || audio.length === 0)) setMode('all')
    if (mode === 'video' && (!tvActive || videos.length === 0)) setMode('all')
  }, [mode, fmActive, tvActive, audio.length, videos.length])

  const loadMore = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const res = await api.get<{ articles: ArticlePayload[]; page: number; pages: number }>(
        `/api/articles${qs({ category: activeSlug, order, page: page + 1, limit: 12 })}`
      )
      setArticles((prev) => [...prev, ...res.articles])
      setPage(res.page)
      setPages(res.pages)
    } catch {
      // silencieux : le bouton reste disponible
    } finally {
      setLoadingMore(false)
    }
  }

  // ---------- États transitoires ----------
  if (treeError) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-20 text-center lg:px-6">
        <p className="text-lg font-semibold">Impossible de charger cette rubrique</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Une erreur réseau est survenue. Relancez le chargement pour réessayer.
        </p>
        <Button onClick={() => setReload((n) => n + 1)}>Réessayer</Button>
      </div>
    )
  }

  if (!tree) return <CategorySkeleton />

  if (!cat) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-20 text-center lg:px-6">
        <FolderOpen className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-lg font-semibold">Rubrique introuvable</p>
        <p className="max-w-md text-sm text-muted-foreground">
          La rubrique demandée n'existe pas ou n'est plus disponible.
        </p>
        <Button onClick={() => navigate({ name: 'home' })}>Retour à l'accueil</Button>
      </div>
    )
  }

  const Icon = categoryIcon(cat.icon)
  const bannerColor = cat.color || '#0A0A0A'
  const textColor = contrastText(bannerColor)
  const segments: { id: Mode; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'articles', label: 'Articles' },
    ...(mediaLoading || audio.length > 0 ? [{ id: 'audio' as Mode, label: 'Audio' }] : []),
    ...(mediaLoading || videos.length > 0 ? [{ id: 'video' as Mode, label: 'Vidéo' }] : []),
  ]

  const articleCards = (list: ArticlePayload[], variant: 'default' | 'horizontal' = 'default') =>
    list.map((a) => (
      <ContentCard
        key={a.id}
        kind="article"
        variant={variant}
        title={a.title}
        slug={a.slug}
        imageUrl={a.coverImageUrl}
        category={a.category ? { name: a.category.name, color: a.category.color } : null}
        meta={`${a.readingTime} min de lecture`}
        date={a.publishedAt || a.createdAt}
      />
    ))

  const loadMoreButton =
    page < pages ? (
      <div className="mt-6 flex justify-center">
        <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="min-h-[44px] gap-2 rounded-full px-6">
          {loadingMore ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Chargement…
            </>
          ) : (
            'Charger plus'
          )}
        </Button>
      </div>
    ) : null

  const emptyState = (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-muted/40 px-6 py-14 text-center">
      <Newspaper className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
      <p className="text-sm font-medium">Aucun contenu dans cette sélection pour le moment</p>
      <p className="text-xs text-muted-foreground">Revenez bientôt : la rédaction prépare de nouveaux sujets.</p>
    </div>
  )

  return (
    <div>
      {/* Fil d'Ariane */}
      <div className="mx-auto max-w-7xl px-4 pt-4 lg:px-6">
        <Breadcrumb
          items={[
            { label: 'Accueil', onClick: () => navigate({ name: 'home' }) },
            ...(cat.parentId
              ? [
                  {
                    label: childrenParentName(tree, cat) ?? 'Rubrique',
                    onClick: () => navigate({ name: 'category', slug: cat.parentId ? parentSlugOf(tree, cat) ?? slug : slug }),
                  },
                ]
              : []),
            { label: cat.name },
          ]}
        />
      </div>

      {/* Bandeau premium de la rubrique */}
      <div className="relative overflow-hidden" style={{ backgroundColor: bannerColor }}>
        {cat.imageUrl && (
          <img src={cat.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-25" aria-hidden="true" />
        )}
        {textColor === '#FFFFFF' && <div className="absolute inset-0 bg-black/25" aria-hidden="true" />}
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:px-6" style={{ color: textColor }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-start gap-4"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner" aria-hidden="true">
              <Icon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-black leading-tight sm:text-3xl">{cat.name}</h1>
              {cat.description && <p className="mt-1.5 max-w-2xl text-sm opacity-85 sm:text-base">{cat.description}</p>}
              {cat.metaDescription && (
                <p className="mt-2 text-xs opacity-55">{cat.metaTitle || cat.metaDescription}</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Barre de filtres sticky */}
      <div className="sticky top-14 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 lg:px-6">
          <div role="tablist" aria-label="Type de contenu" className="flex flex-wrap gap-1">
            {segments.map((seg) => (
              <button
                key={seg.id}
                type="button"
                role="tab"
                aria-selected={mode === seg.id}
                onClick={() => setMode(seg.id)}
                className={cn(
                  'min-h-[40px] rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-marque',
                  mode === seg.id
                    ? 'bg-marque text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {seg.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select value={order} onValueChange={(v) => setOrder(v as 'recent' | 'views')}>
              <SelectTrigger className="h-10 w-[160px]" aria-label="Trier les articles">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Plus récents</SelectItem>
                <SelectItem value="views">Plus populaires</SelectItem>
              </SelectContent>
            </Select>
            {children.length > 0 && (
              <Select value={subSlug} onValueChange={setSubSlug}>
                <SelectTrigger className="h-10 w-[190px]" aria-label="Sous-rubrique">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toute la rubrique</SelectItem>
                  {children.map((ch) => (
                    <SelectItem key={ch.id} value={ch.slug}>
                      {ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Contenu + sidebar */}
      <div className="mx-auto max-w-7xl px-4 py-6 lg:grid lg:grid-cols-3 lg:gap-8 lg:px-6">
        <div className="min-w-0 lg:col-span-2">
          {mode === 'all' && (
            <div className="space-y-8">
              <section aria-label="Articles de la rubrique">
                {articlesLoading ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="space-y-3" aria-hidden="true">
                        <Skeleton className="aspect-video rounded-xl" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : articles.length > 0 ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">{articleCards(articles.slice(0, 6))}</div>
                    {(total > 6 || audio.length > 0 || videos.length > 0) && (
                      <div className="mt-5 flex justify-center">
                        <Button variant="outline" onClick={() => setMode('articles')} className="min-h-[44px] rounded-full px-6">
                          Voir tous les articles ({total})
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  emptyState
                )}
              </section>

              {audio.length > 0 && (
                <section aria-label="Audio de la rubrique">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    <span className="h-4 w-1 rounded bg-jaune" aria-hidden="true" />
                    FM — Écouter
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {audio.map((ep) => (
                      <AudioRow key={ep.id} episode={ep} queue={audio} />
                    ))}
                  </div>
                </section>
              )}

              {videos.length > 0 && (
                <section aria-label="Vidéos de la rubrique">
                  <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    <span className="h-4 w-1 rounded bg-rouge" aria-hidden="true" />
                    TV — Regarder
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {videos.map((v) => (
                      <ContentCard
                        key={v.id}
                        kind="video"
                        title={v.title}
                        slug={v.id}
                        imageUrl={v.thumbnailUrl || (v.youtubeId ? `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg` : null)}
                        category={v.category ? { name: v.category.name, color: v.category.color } : null}
                        date={v.publishedAt || v.createdAt}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {mode === 'articles' && (
            <section aria-label="Tous les articles">
              {articlesLoading ? (
                <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-video rounded-xl" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : articles.length > 0 ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">{articleCards(articles)}</div>
                  {loadMoreButton}
                </>
              ) : (
                emptyState
              )}
            </section>
          )}

          {mode === 'audio' && (
            <section aria-label="Tous les contenus audio">
              <div className="grid gap-3 md:grid-cols-2">
                {audio.map((ep) => (
                  <AudioRow key={ep.id} episode={ep} queue={audio} />
                ))}
              </div>
              {audio.length === 0 && emptyState}
            </section>
          )}

          {mode === 'video' && (
            <section aria-label="Toutes les vidéos">
              <div className="grid gap-4 sm:grid-cols-2">
                {videos.map((v) => (
                  <ContentCard
                    key={v.id}
                    kind="video"
                    title={v.title}
                    slug={v.id}
                    imageUrl={v.thumbnailUrl || (v.youtubeId ? `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg` : null)}
                    category={v.category ? { name: v.category.name, color: v.category.color } : null}
                    date={v.publishedAt || v.createdAt}
                  />
                ))}
              </div>
              {videos.length === 0 && emptyState}
            </section>
          )}
        </div>

        {/* Sidebar desktop */}
        <aside className="mt-10 space-y-6 lg:col-span-1 lg:mt-0">
          <AdSlotView slot="sidebar" minHeight={250} />

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
              <span className="h-4 w-1 rounded bg-marque" aria-hidden="true" />
              Les plus consultés de la rubrique
            </h2>
            {topArticles.length > 0 ? (
              <MostReadBlock articles={topArticles} />
            ) : (
              <Skeleton className="h-40 rounded-xl" aria-hidden="true" />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ---------- Aides pour le fil d'Ariane (rubrique parente) ----------
function findCategory(list: CategoryPayload[], id: string): CategoryPayload | null {
  for (const c of list) {
    if (c.id === id) return c
    if (c.children?.length) {
      const found = findCategory(c.children, id)
      if (found) return found
    }
  }
  return null
}

function childrenParentName(tree: CategoryPayload[] | null, cat: CategoryPayload): string | null {
  if (!tree || !cat.parentId) return null
  return findCategory(tree, cat.parentId)?.name ?? null
}

function parentSlugOf(tree: CategoryPayload[] | null, cat: CategoryPayload): string | null {
  if (!tree || !cat.parentId) return null
  return findCategory(tree, cat.parentId)?.slug ?? null
}
