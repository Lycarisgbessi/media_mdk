'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Headphones, Loader2, Newspaper, Play, Search, SearchX } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { View, ArticlePayload, AudioContentPayload, VideoPayload } from '@/lib/types'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SearchPayload {
  articles: ArticlePayload[]
  audio: AudioContentPayload[]
  videos: VideoPayload[]
}

/** Ligne de résultat compacte avec icône de type. */
function ResultRow({
  kind,
  title,
  subtitle,
  onSelect,
}: {
  kind: 'article' | 'audio' | 'video'
  title: string
  subtitle?: string | null
  onSelect: () => void
}) {
  const Icon = kind === 'article' ? Newspaper : kind === 'audio' ? Headphones : Play
  const color =
    kind === 'article'
      ? 'bg-marque/15 text-marque'
      : kind === 'audio'
        ? 'bg-jaune/20 text-yellow-700 dark:text-jaune'
        : 'bg-rouge/15 text-rouge'
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`} aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
    </button>
  )
}

/**
 * Overlay de recherche instantanée (Ctrl via bouton header).
 * Résultats groupés, navigation directe ou recherche avancée.
 */
export function SearchOverlay() {
  const searchOpen = useAppStore((s) => s.searchOpen)
  const setSearchOpen = useAppStore((s) => s.setSearchOpen)
  const navigate = useAppStore((s) => s.navigate)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Réinitialisation à chaque ouverture
  useEffect(() => {
    if (searchOpen) {
      setQ('')
      setResults(null)
      setLoading(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [searchOpen])

  // Recherche instantanée avec debounce 300 ms
  useEffect(() => {
    const term = q.trim()
    if (!term) {
      setResults(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      api
        .get<SearchPayload>(`/api/search?q=${encodeURIComponent(term)}`)
        .then((res) => setResults(res))
        .catch(() => setResults({ articles: [], audio: [], videos: [] }))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const go = (v: View) => {
    setSearchOpen(false)
    navigate(v)
  }

  const hasResults =
    !!results && (results.articles.length > 0 || results.audio.length > 0 || results.videos.length > 0)

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="top-[12%] max-h-[75vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Recherche</DialogTitle>
        <DialogDescription className="sr-only">
          Recherchez un article, un podcast ou une vidéo dans tout le média.
        </DialogDescription>

        <form
          className="flex items-center gap-2 border-b px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            const term = q.trim()
            if (!term) return
            go({ name: 'search', q: term })
          }}
        >
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un article, un podcast, une vidéo…"
            aria-label="Recherche"
            className="h-10 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />}
        </form>

        <div className="scroll-slim max-h-[55vh] overflow-y-auto p-2">
          {!q.trim() && (
            <div className="p-6 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
              <p className="mt-2 text-sm text-muted-foreground">
                Saisissez un mot-clé pour explorer articles, FM et TV.
              </p>
            </div>
          )}

          {q.trim() && results && !hasResults && !loading && (
            <div className="p-6 text-center">
              <SearchX className="mx-auto h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
              <p className="mt-2 text-sm text-muted-foreground">Aucun résultat pour « {q.trim()} »</p>
            </div>
          )}

          {results && results.articles.length > 0 && (
            <section className="mb-2">
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Articles
              </p>
              {results.articles.slice(0, 5).map((a) => (
                <ResultRow
                  key={a.id}
                  kind="article"
                  title={a.title}
                  subtitle={a.category?.name}
                  onSelect={() => go({ name: 'article', slug: a.slug })}
                />
              ))}
            </section>
          )}

          {results && results.audio.length > 0 && (
            <section className="mb-2">
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                FM — Audio
              </p>
              {results.audio.slice(0, 3).map((a) => (
                <ResultRow
                  key={a.id}
                  kind="audio"
                  title={a.title}
                  subtitle={a.show?.name || a.category?.name}
                  onSelect={() => go({ name: 'episode', slug: a.slug })}
                />
              ))}
            </section>
          )}

          {results && results.videos.length > 0 && (
            <section className="mb-2">
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                TV — Vidéos
              </p>
              {results.videos.slice(0, 3).map((v) => (
                <ResultRow
                  key={v.id}
                  kind="video"
                  title={v.title}
                  subtitle={v.category?.name}
                  onSelect={() => go({ name: 'video', id: v.id })}
                />
              ))}
            </section>
          )}
        </div>

        <div className="border-t p-3">
          <Button
            variant="outline"
            className="min-h-[44px] w-full justify-center gap-2 text-sm"
            onClick={() => {
              const term = q.trim()
              go({ name: 'search', q: term })
            }}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Recherche avancée{q.trim() ? ` : « ${q.trim()} »` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
