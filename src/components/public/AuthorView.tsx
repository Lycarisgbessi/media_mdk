'use client'

// =====================================================================
// AuthorView — profil public d'un auteur : bio, statistiques et
// ses contenus publiés (articles, épisodes FM, vidéos)
// =====================================================================

import { useEffect, useState } from 'react'
import { Headphones, Newspaper, PenLine, Play } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { ROLE_LABELS } from '@/lib/types'
import type { ArticlePayload, AudioContentPayload, VideoPayload } from '@/lib/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Breadcrumb } from './Breadcrumb'
import { ContentCard } from './ContentCard'

interface AuthorProfile {
  id: string
  firstName: string
  lastName: string
  role: string
  bio?: string | null
  avatarUrl?: string | null
}

export function AuthorView({ id }: { id: string }) {
  const navigate = useAppStore((s) => s.navigate)

  const [author, setAuthor] = useState<AuthorProfile | null>(null)
  const [stats, setStats] = useState<{ articles: number; audio: number; videos: number } | null>(null)
  const [articles, setArticles] = useState<ArticlePayload[]>([])
  const [audio, setAudio] = useState<AudioContentPayload[]>([])
  const [videos, setVideos] = useState<VideoPayload[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get<{ user: AuthorProfile; stats: { articles: number; audio: number; videos: number } }>(
        `/api/authors/${encodeURIComponent(id)}`,
      ),
      api.get<{ articles: ArticlePayload[] }>(`/api/articles?author=${encodeURIComponent(id)}&limit=24`),
      api.get<{ audio: AudioContentPayload[] }>(`/api/audio?author=${encodeURIComponent(id)}&limit=24`),
      api.get<{ videos: VideoPayload[] }>(`/api/videos?author=${encodeURIComponent(id)}&limit=24`),
    ])
      .then(([profile, art, aud, vid]) => {
        if (cancelled) return
        setAuthor(profile.user)
        setStats(profile.stats)
        setArticles(Array.isArray(art.articles) ? art.articles : [])
        setAudio(Array.isArray(aud.audio) ? aud.audio : [])
        setVideos(Array.isArray(vid.videos) ? vid.videos : [])
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6" aria-busy="true">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="aspect-video rounded-xl" />
          <Skeleton className="aspect-video rounded-xl" />
          <Skeleton className="aspect-video rounded-xl" />
        </div>
      </div>
    )
  }

  if (!author) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Auteur introuvable</h1>
        <p className="text-sm text-muted-foreground">Ce profil n&apos;existe pas ou n&apos;est plus actif.</p>
        <Button onClick={() => navigate({ name: 'home' })} className="mt-2 min-h-[44px]">
          Retour à l&apos;accueil
        </Button>
      </div>
    )
  }

  const fullName = `${author.firstName} ${author.lastName}`

  return (
    <div className="pb-16">
      {/* ---- Profil ---- */}
      <div className="border-b bg-gradient-to-br from-marque-clair/60 to-transparent dark:from-marque/10">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <Breadcrumb
            items={[{ label: 'Accueil', onClick: () => navigate({ name: 'home' }) }, { label: fullName }]}
          />
          <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20 border-2 border-marque/30 shadow-md">
              {author.avatarUrl && <img src={author.avatarUrl} alt="" className="h-full w-full object-cover" />}
              <AvatarFallback className="bg-marque text-2xl font-black text-white">
                {author.firstName.charAt(0)}
                {author.lastName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{fullName}</h1>
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-marque">
                <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                {ROLE_LABELS[author.role] ?? 'Journaliste'}
              </p>
              {author.bio && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{author.bio}</p>}
            </div>
            {stats && (
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Articles', value: stats.articles },
                  { label: 'Audios', value: stats.audio },
                  { label: 'Vidéos', value: stats.videos },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border bg-card px-3 py-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</dt>
                    <dd className="text-lg font-black tabular-nums">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>

      {/* ---- Contenus ---- */}
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <Tabs defaultValue="articles">
          <TabsList aria-label="Contenus de l'auteur">
            <TabsTrigger value="articles" className="gap-1.5">
              <Newspaper className="h-4 w-4" aria-hidden="true" />
              Articles
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-1.5">
              <Headphones className="h-4 w-4" aria-hidden="true" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5">
              <Play className="h-4 w-4" aria-hidden="true" />
              Vidéos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="articles" className="mt-6">
            {articles.length === 0 ? (
              <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                Aucun article publié pour le moment.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </TabsContent>

          <TabsContent value="audio" className="mt-6">
            {audio.length === 0 ? (
              <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                Aucun épisode audio publié pour le moment.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {audio.map((ep) => (
                  <ContentCard
                    key={ep.id}
                    kind="audio"
                    title={ep.title}
                    slug={ep.slug}
                    imageUrl={ep.coverImageUrl}
                    category={ep.category ? { name: ep.category.name, color: ep.category.color } : null}
                    date={ep.publishedAt || ep.createdAt}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="mt-6">
            {videos.length === 0 ? (
              <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                Aucune vidéo publiée pour le moment.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {videos.map((v) => (
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
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
