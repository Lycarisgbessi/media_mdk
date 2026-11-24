'use client'

// =====================================================================
// TagView — articles associés à un mot-clé (tag)
// =====================================================================

import { useEffect, useState } from 'react'
import { Tag as TagIcon } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { ArticlePayload, TagPayload } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumb } from './Breadcrumb'
import { ContentCard } from './ContentCard'

export function TagView({ slug }: { slug: string }) {
  const navigate = useAppStore((s) => s.navigate)

  const [tag, setTag] = useState<TagPayload | null>(null)
  const [articles, setArticles] = useState<ArticlePayload[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ articles: ArticlePayload[] }>(`/api/articles?tag=${encodeURIComponent(slug)}&limit=24`)
      .then((res) => {
        if (cancelled) return
        const list = Array.isArray(res.articles) ? res.articles : []
        setArticles(list)
        // Nom lisible du tag récupéré sur le premier résultat
        setTag(list[0]?.tags?.find((t) => t.slug === slug) ?? null)
      })
      .catch(() => {
        if (!cancelled) setArticles([])
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const label = tag?.name ?? `#${slug}`

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <Breadcrumb
        items={[{ label: 'Accueil', onClick: () => navigate({ name: 'home' }) }, { label: `#${label}` }]}
      />
      <h1 className="mt-4 flex items-center gap-2.5 text-2xl font-black tracking-tight sm:text-3xl">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-marque text-white">
          <TagIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        {label}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {articles === null ? 'Chargement…' : `${articles.length} contenu${articles.length > 1 ? 's' : ''} associé${articles.length > 1 ? 's' : ''}`}
      </p>

      {articles === null ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed px-6 py-16 text-center">
          <TagIcon className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-semibold">Aucun contenu pour ce mot-clé</p>
          <Button variant="outline" className="mt-4 min-h-[44px]" onClick={() => navigate({ name: 'home' })}>
            Retour à l&apos;accueil
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ContentCard
              key={a.id}
              kind="article"
              title={a.title}
              slug={a.slug}
              imageUrl={a.coverImageUrl}
              category={a.category ? { name: a.category.name, color: a.category.color } : null}
              meta={`${a.readingTime} min`}
              date={a.publishedAt || a.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  )
}
