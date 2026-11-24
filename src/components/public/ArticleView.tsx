'use client'

// =====================================================================
// ArticleView — page article : couverture, chapeau, corps (police choisie),
// tags, partage, publicité intercalaire, articles liés, commentaires.
// SEO client : <title>, meta description et JSON-LD Article (§13).
// =====================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  Clock3,
  Eye,
  Home,
  Share2,
  Tag as TagIcon,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { drivePlayableUrl, formatDate, markdownToHtml } from '@/lib/helpers'
import type { ArticlePayload, TypographyOptionPayload } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Breadcrumb } from './Breadcrumb'
import { ContentCard } from './ContentCard'
import { AdSlotView } from './AdSlotView'
import { CommentsSection } from './CommentsSection'
import { SharePanel } from './SharePanel'

// ---------- Gestion du head (title, description, JSON-LD) ----------

function useDocumentHead(title: string, description: string, jsonLd: object | null) {
  useEffect(() => {
    if (title) document.title = title
    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
      }
      meta.content = description
    }
    const id = 'jsonld-current-view'
    document.getElementById(id)?.remove()
    if (jsonLd) {
      const script = document.createElement('script')
      script.id = id
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
    return () => {
      document.getElementById(id)?.remove()
    }
  }, [title, description, jsonLd])
}

// ---------- Squelettes ----------

function ArticleSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8" aria-busy="true" aria-label="Chargement de l'article">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-4/5" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}

function NotFound({ label }: { label: string }) {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-marque-clair dark:bg-marque/15">
        <ChevronLeft className="h-7 w-7 text-marque" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold">{label}</h1>
      <p className="text-sm text-muted-foreground">
        Le contenu recherché n&apos;existe pas ou n&apos;est plus disponible.
      </p>
      <Button onClick={() => navigate({ name: 'home' })} className="mt-2 min-h-[44px] gap-2">
        <Home className="h-4 w-4" aria-hidden="true" />
        Retour à l&apos;accueil
      </Button>
    </div>
  )
}

// =====================================================================
// Vue principale
// =====================================================================

export function ArticleView({ slug }: { slug: string }) {
  const navigate = useAppStore((s) => s.navigate)
  const settings = useAppStore((s) => s.settings)

  const [article, setArticle] = useState<ArticlePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [fonts, setFonts] = useState<TypographyOptionPayload[]>([])
  const [related, setRelated] = useState<ArticlePayload[]>([])
  const [shareOpen, setShareOpen] = useState(false)

  // ---- Chargement de l'article ----
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setArticle(null)
    api
      .get<{ article: ArticlePayload }>(`/api/articles/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (cancelled) return
        setArticle(res.article)
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
  }, [slug])

  // ---- Polices disponibles (§17.4) ----
  useEffect(() => {
    let cancelled = false
    api
      .get<{ typography: TypographyOptionPayload[] }>('/api/typography')
      .then((res) => {
        if (!cancelled) setFonts(Array.isArray(res.typography) ? res.typography : [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // ---- Articles liés (même rubrique, sinon plus récents) ----
  useEffect(() => {
    if (!article) return
    let cancelled = false
    const q = article.categoryId
      ? `/api/articles?category=${encodeURIComponent(article.category?.slug ?? '')}&exclude=${article.id}&limit=3`
      : `/api/articles?exclude=${article.id}&limit=3`
    api
      .get<{ articles: ArticlePayload[] }>(q)
      .then((res) => {
        if (!cancelled) setRelated((res.articles ?? []).filter((a) => a.id !== article.id).slice(0, 3))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [article])

  const fontClass =
    fonts.find((f) => f.id === article?.fontId)?.cssFamily || 'font-article-moderne'

  // ---- Corps : HTML (éditeur visuel) ou markdown historique ----
  // Les marqueurs [AUDIO:slug] / [VIDEO:id] (contenus historiques ou bouton
  // « Audio » de l'éditeur) sont convertis en lecteurs réels.
  const bodyRef = useRef<HTMLDivElement>(null)
  const bodyHtml = useMemo(() => {
    let html = markdownToHtml(article?.content ?? '')
    html = html.replace(
      /<p>\s*\[VIDEO:([\w-]+)\]\s*<\/p>/g,
      (_m, id) =>
        `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Vidéo YouTube" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`,
    )
    html = html.replace(
      /<p>\s*\[AUDIO:([\w-]+)\]\s*<\/p>/g,
      (_m, slug) => `<div class="audio-embed" data-slug="${slug}"></div>`,
    )
    return html
  }, [article?.content])

  // ---- Hydratation des épisodes audio intégrés (lecteurs FM) ----
  useEffect(() => {
    const root = bodyRef.current
    if (!root || !article) return
    const nodes = Array.from(root.querySelectorAll<HTMLDivElement>('div.audio-embed[data-slug]')).filter(
      (n) => n.childElementCount === 0,
    )
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    nodes.forEach((node) => {
      const slug = node.dataset.slug ?? ''
      api
        .get<{ audio: { title: string; googleDriveUrl?: string | null; googleDriveFileId?: string | null } }>(
          `/api/audio/${encodeURIComponent(slug)}`,
        )
        .then((res) => {
          const ep = res.audio
          const src = drivePlayableUrl(ep?.googleDriveUrl, ep?.googleDriveFileId)
          node.innerHTML = src
            ? `<p>🎧 ${esc(ep?.title ?? slug)}</p><audio controls preload="none" src="${src}"></audio>`
            : `<p class="audio-embed-error">Épisode « ${esc(slug)} » indisponible</p>`
        })
        .catch(() => {
          node.innerHTML = `<p class="audio-embed-error">Épisode « ${esc(slug)} » introuvable</p>`
        })
    })
  }, [article, bodyHtml])

  const siteName = settings?.siteName || 'Média'
  useDocumentHead(
    article ? `${article.metaTitle || article.title} | ${siteName}` : 'Chargement…',
    article?.metaDescription || article?.lede || '',
    article
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          description: article.metaDescription || article.lede || '',
          image: article.coverImageUrl || undefined,
          datePublished: article.publishedAt || article.createdAt,
          dateModified: article.updatedAt,
          inLanguage: 'fr-FR',
          author: article.author
            ? { '@type': 'Person', name: `${article.author.firstName} ${article.author.lastName}` }
            : undefined,
          publisher: { '@type': 'Organization', name: siteName },
          articleSection: article.category?.name,
          keywords: article.metaKeywords || article.tags?.map((t) => t.name).join(', ') || undefined,
        }
      : null,
  )

  if (loading) return <ArticleSkeleton />
  if (notFound || !article) return <NotFound label="Article introuvable" />

  const commentsEnabled = settings?.commentsEnabled !== false && article.commentsOpen

  return (
    <div className="pb-16">
      <article className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
        <Breadcrumb
          items={[
            { label: 'Accueil', onClick: () => navigate({ name: 'home' }) },
            ...(article.category
              ? [{ label: article.category.name, onClick: () => navigate({ name: 'category', slug: article.category!.slug }) }]
              : []),
            { label: article.title },
          ]}
        />

        {/* ---- Catégorie ---- */}
        {article.category && (
          <button
            type="button"
            onClick={() => navigate({ name: 'category', slug: article.category!.slug })}
            className="mt-5 inline-flex min-h-[32px] items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-85"
            style={{ backgroundColor: article.category.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />
            {article.category.name}
          </button>
        )}

        {/* ---- Titre & chapeau ---- */}
        <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          {article.title}
        </h1>
        {article.subtitle && (
          <p className="mt-2 text-lg font-medium text-muted-foreground">{article.subtitle}</p>
        )}
        {article.lede && (
          <p className="mt-4 border-l-4 border-jaune pl-4 text-lg leading-relaxed text-foreground/90">
            {article.lede}
          </p>
        )}

        {/* ---- Métadonnées ---- */}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
          {article.author && (
            <button
              type="button"
              onClick={() => navigate({ name: 'author', id: article.author!.id })}
              className="group flex min-h-[44px] items-center gap-2.5 rounded-lg text-left transition-colors hover:text-marque focus-visible:outline-2 focus-visible:outline-marque"
            >
              <Avatar className="h-10 w-10 border">
                <AvatarFallback className="bg-marque-clair text-xs font-bold text-marque dark:bg-marque/15">
                  {article.author.firstName.charAt(0)}
                  {article.author.lastName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="leading-tight">
                <span className="block text-sm font-semibold group-hover:underline">
                  {article.author.firstName} {article.author.lastName}
                </span>
                <span className="block text-xs text-muted-foreground">Auteur·e</span>
              </span>
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDate(article.publishedAt || article.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {article.readingTime} min de lecture
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {article.views.toLocaleString('fr-FR')} vues
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareOpen(true)}
            className="ml-auto min-h-[40px] gap-1.5 rounded-full"
            aria-label="Partager cet article"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Partager
          </Button>
        </div>

        {/* ---- Publicité au-dessus de l'article ---- */}
        <div className="mt-4">
          <AdSlotView slot="article_top" minHeight={90} />
        </div>

        <Separator className="my-6" />

        {/* ---- Couverture ---- */}
        {article.coverImageUrl && (
          <figure className="mb-6">
            <img
              src={article.coverImageUrl}
              alt={article.coverCaption || article.title}
              className="aspect-video w-full rounded-xl object-cover"
              loading="eager"
            />
            {(article.coverCaption || article.coverCredit) && (
              <figcaption className="mt-2 text-xs text-muted-foreground">
                {article.coverCaption}
                {article.coverCredit ? ` — ${article.coverCredit}` : ''}
              </figcaption>
            )}
          </figure>
        )}

        {/* ---- Corps de l'article (police choisie §17.4) ---- */}
        <div
          ref={bodyRef}
          className={`article-body ${fontClass}`}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {/* ---- Publicité intercalaire ---- */}
        <div className="mt-8">
          <AdSlotView slot="article_inline" minHeight={90} />
        </div>

        {/* ---- Tags ---- */}
        {(article.tags?.length ?? 0) > 0 && (
          <div className="mt-8">
            <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <TagIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Mots-clés
            </p>
            <div className="flex flex-wrap gap-2">
              {article.tags!.map((tag) => (
                <Button
                  key={tag.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate({ name: 'tag', slug: tag.slug })}
                  className="min-h-[36px] rounded-full text-xs font-semibold"
                >
                  #{tag.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* ---- Publicité bas d'article ---- */}
        <div className="mt-8">
          <AdSlotView slot="article_bottom" minHeight={90} />
        </div>
      </article>

      {/* ---- Articles liés ---- */}
      {related.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6" aria-labelledby="related-title">
          <div className="mb-4 flex items-center gap-2">
            <h2 id="related-title" className="text-lg font-bold uppercase tracking-wide">
              À lire aussi
            </h2>
            <span className="h-0.5 flex-1 bg-border" aria-hidden="true" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((a) => (
              <ContentCard
                key={a.id}
                kind="article"
                title={a.title}
                slug={a.slug}
                imageUrl={a.coverImageUrl}
                category={a.category ? { name: a.category.name, color: a.category.color } : null}
                date={a.publishedAt || a.createdAt}
                meta={`${a.readingTime} min`}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- Commentaires ---- */}
      {commentsEnabled && (
        <section className="mx-auto max-w-3xl px-4 pt-12 sm:px-6" aria-labelledby="comments-title">
          <h2 id="comments-title" className="mb-4 text-lg font-bold uppercase tracking-wide">
            Commentaires
          </h2>
          <CommentsSection contentType="article" contentId={article.id} />
        </section>
      )}

      <div className="mx-auto mt-12 max-w-3xl px-4 sm:px-6">
        <Button variant="ghost" onClick={() => navigate({ name: 'home' })} className="min-h-[44px] gap-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Toutes les actualités
        </Button>
      </div>

      <SharePanel
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={article.title}
        contentType="article"
        contentId={article.id}
      />
    </div>
  )
}
