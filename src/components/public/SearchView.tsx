'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Search, SearchX } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { ArticlePayload, AudioContentPayload, CategoryPayload, VideoPayload } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContentCard } from '@/components/public/ContentCard'

interface SearchPayload {
  articles: ArticlePayload[]
  audio: AudioContentPayload[]
  videos: VideoPayload[]
  page?: number
  hasMore?: boolean
  totals?: { articles: number; audio: number; videos: number; all: number }
}

const EMPTY: SearchPayload = { articles: [], audio: [], videos: [] }

/**
 * Page de recherche avancée : champ contrôlé, onglets par type de contenu,
 * suggestions de rubriques en cas d'absence de résultat.
 */
export function SearchView({ q }: { q: string }) {
  const navigate = useAppStore((s) => s.navigate)
  const [term, setTerm] = useState(q)
  const [results, setResults] = useState<SearchPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [popularCategories, setPopularCategories] = useState<CategoryPayload[]>([])

  // Synchronisation avec la vue (navigation depuis l'overlay ou le header)
  useEffect(() => {
    setTerm(q)
    setPage(1)
  }, [q])

  // Recherche avec debounce 400 ms
  useEffect(() => {
    const value = term.trim()
    if (!value) {
      setResults(null)
      setLoading(false)
      setError(false)
      return
    }
    setLoading(true)
    setError(false)
    const timer = setTimeout(() => {
      api
        .get<SearchPayload>(`/api/search?q=${encodeURIComponent(value)}&page=1`)
        .then((res) => setResults(res))
        .catch(() => {
          setResults(EMPTY)
          setError(true)
        })
        .finally(() => setLoading(false))
    }, 400)
    return () => clearTimeout(timer)
  }, [term, reload])

  // Chargement progressif (page suivante, accumulation des résultats)
  const loadMore = () => {
    const value = term.trim()
    if (!value || loadingMore || !results || !results.hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    api
      .get<SearchPayload>(`/api/search?q=${encodeURIComponent(value)}&page=${nextPage}`)
      .then((res) => {
        setResults({
          ...res,
          articles: [...results.articles, ...(res.articles ?? [])],
          audio: [...results.audio, ...(res.audio ?? [])],
          videos: [...results.videos, ...(res.videos ?? [])],
        })
        setPage(nextPage)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }

  // Rubriques populaires (suggestions)
  useEffect(() => {
    api
      .get<{ categories: CategoryPayload[] }>('/api/categories')
      .then((res) => setPopularCategories((res.categories ?? []).slice(0, 6)))
      .catch(() => {})
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = term.trim()
    if (!value) return
    navigate({ name: 'search', q: value })
  }

  const audioOf = results?.audio ?? []
  const videosOf = results?.videos ?? []
  const articlesOf = results?.articles ?? []
  const hasQuery = !!term.trim()
  const noResults =
    hasQuery && !loading && !error && results
      ? articlesOf.length === 0 && audioOf.length === 0 && videosOf.length === 0
      : false

  const audioCards = (list: AudioContentPayload[]) =>
    list.map((a) => (
      <ContentCard
        key={a.id}
        kind="audio"
        variant="horizontal"
        title={a.title}
        slug={a.slug}
        imageUrl={a.coverImageUrl}
        category={a.category ? { name: a.category.name, color: a.category.color } : null}
        meta={a.show?.name || undefined}
        date={a.publishedAt || a.createdAt}
      />
    ))

  const videoCards = (list: VideoPayload[]) =>
    list.map((v) => (
      <ContentCard
        key={v.id}
        kind="video"
        title={v.title}
        slug={v.id}
        imageUrl={v.thumbnailUrl || (v.youtubeId ? `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg` : null)}
        category={v.category ? { name: v.category.name, color: v.category.color } : null}
        date={v.publishedAt || v.createdAt}
      />
    ))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
      {/* Champ de recherche principal */}
      <form onSubmit={submit} className="mx-auto flex max-w-2xl gap-2" role="search">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Rechercher un article, un podcast, une vidéo…"
            aria-label="Recherche"
            className="h-12 rounded-full bg-card pl-11 pr-4 text-base shadow-sm"
            autoFocus
          />
        </div>
        <Button type="submit" className="h-12 rounded-full px-6 font-semibold">
          Rechercher
        </Button>
      </form>

      {hasQuery && (
        <p className="mt-4 text-center text-sm text-muted-foreground" aria-live="polite">
          {loading
            ? 'Recherche en cours…'
            : `${results?.totals?.all ?? articlesOf.length + audioOf.length + videosOf.length} résultat(s) pour « ${term.trim()} »`}
        </p>
      )}

      {/* État initial : aucune recherche */}
      {!hasQuery && (
        <div className="mt-12 text-center">
          <p className="text-lg font-semibold">Que souhaitez-vous découvrir ?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Explorez nos rubriques les plus consultées pour commencer.
          </p>
          {popularCategories.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {popularCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate({ name: 'category', slug: c.slug })}
                  className="min-h-[44px] rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:border-marque hover:text-marque"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chargement : squelettes */}
      {loading && hasQuery && (
        <div className="mt-8 space-y-4" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Aucun résultat */}
      {noResults && (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <SearchX className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-lg font-semibold">Aucun résultat pour « {term.trim()} »</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Essayez avec d'autres mots-clés, ou explorez directement nos rubriques :
          </p>
          {popularCategories.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {popularCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate({ name: 'category', slug: c.slug })}
                  className="min-h-[44px] rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:border-marque hover:text-marque"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Erreur réseau */}
      {error && (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium">La recherche n'a pas abouti</p>
          <Button variant="outline" onClick={() => setReload((n) => n + 1)} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Réessayer
          </Button>
        </div>
      )}

      {/* Résultats par onglets */}
      {hasQuery && !loading && !error && results && !noResults && (
        <Tabs defaultValue="all" className="mt-6">
          <TabsList className="mx-auto flex w-full max-w-md sm:w-auto">
            <TabsTrigger value="all" className="flex-1 sm:flex-none">Tout</TabsTrigger>
            <TabsTrigger value="articles" className="flex-1 sm:flex-none">Articles ({articlesOf.length})</TabsTrigger>
            <TabsTrigger value="audio" className="flex-1 sm:flex-none">Audio ({audioOf.length})</TabsTrigger>
            <TabsTrigger value="videos" className="flex-1 sm:flex-none">Vidéos ({videosOf.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6 space-y-8">
            {articlesOf.length > 0 && (
              <section aria-label="Articles trouvés">
                <h2 className="mb-4 flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="h-4 w-1 rounded bg-marque" aria-hidden="true" />
                  Articles
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {articlesOf.map((a) => (
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
              </section>
            )}
            {audioOf.length > 0 && (
              <section aria-label="Audio trouvé">
                <h2 className="mb-4 flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="h-4 w-1 rounded bg-jaune" aria-hidden="true" />
                  FM — Audio
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">{audioCards(audioOf)}</div>
              </section>
            )}
            {videosOf.length > 0 && (
              <section aria-label="Vidéos trouvées">
                <h2 className="mb-4 flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="h-4 w-1 rounded bg-rouge" aria-hidden="true" />
                  TV — Vidéos
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">{videoCards(videosOf)}</div>
              </section>
            )}
          </TabsContent>

          <TabsContent value="articles" className="mt-6">
            {articlesOf.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {articlesOf.map((a) => (
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
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucun article ne correspond à votre recherche.
              </p>
            )}
          </TabsContent>

          <TabsContent value="audio" className="mt-6">
            {audioOf.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">{audioCards(audioOf)}</div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucun podcast ne correspond à votre recherche.</p>
            )}
          </TabsContent>

          <TabsContent value="videos" className="mt-6">
            {videosOf.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">{videoCards(videosOf)}</div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucune vidéo ne correspond à votre recherche.</p>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Chargement progressif : pages suivantes de résultats */}
      {hasQuery && !loading && !error && results?.hasMore && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="min-h-[44px] gap-2">
            {loadingMore ? 'Chargement…' : 'Charger plus de résultats'}
          </Button>
        </div>
      )}
    </div>
  )
}
