'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { timeAgo } from '@/lib/helpers'
import type { ArticlePayload } from '@/lib/types'

/** Carte principale « à la une » : image plein cadre + overlay dégradé. */
function MainFeatured({ article }: { article: ArticlePayload }) {
  const navigate = useAppStore((s) => s.navigate)
  const [imgOk, setImgOk] = useState(true)

  return (
    <motion.article
      role="button"
      tabIndex={0}
      aria-label={article.title}
      onClick={() => navigate({ name: 'article', slug: article.slug })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate({ name: 'article', slug: article.slug })
        }
      }}
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45 }}
      className="group relative flex h-full min-h-[320px] cursor-pointer flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br from-marque-fonce to-marque focus-visible:outline-2 focus-visible:outline-marque sm:min-h-[380px]"
    >
      {article.coverImageUrl && imgOk ? (
        <img
          src={article.coverImageUrl}
          alt={article.title}
          loading="lazy"
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" aria-hidden="true" />

      <div className="relative flex flex-col gap-2 p-4 sm:p-6">
        {article.category && (
          <span
            className="w-fit rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm"
            style={{ backgroundColor: article.category.color }}
          >
            {article.category.name}
          </span>
        )}
        <h2 className="max-w-3xl text-2xl font-bold leading-tight text-white underline-offset-4 group-hover:underline sm:text-3xl">
          {article.title}
        </h2>
        {article.lede && <p className="line-clamp-2 max-w-2xl text-sm text-white/85 sm:text-base">{article.lede}</p>}
        <p className="text-xs text-white/65">{timeAgo(article.publishedAt || article.createdAt)}</p>
      </div>
    </motion.article>
  )
}

/**
 * Bloc « À la une » : une grande carte (2/3) + deux cartes secondaires empilées.
 */
export function FeaturedBlock({ articles }: { articles: ArticlePayload[] }) {
  const sorted = [...articles].sort((a, b) => (a.featuredRank ?? 99) - (b.featuredRank ?? 99))
  if (!sorted.length) return null

  const [main, ...rest] = sorted
  const secondary = rest.slice(0, 2)

  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="lg:col-span-2">
        <MainFeatured article={main} />
      </div>
      {secondary.length > 0 && (
        <div className="flex flex-col gap-4 lg:gap-6">
          {secondary.map((a) => (
            <SecondaryFeatured key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Carte secondaire : vignette à gauche + titre en avant. */
function SecondaryFeatured({ article }: { article: ArticlePayload }) {
  const navigate = useAppStore((s) => s.navigate)
  const [imgOk, setImgOk] = useState(true)

  return (
    <motion.article
      role="button"
      tabIndex={0}
      aria-label={article.title}
      onClick={() => navigate({ name: 'article', slug: article.slug })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate({ name: 'article', slug: article.slug })
        }
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.1 }}
      className="group flex flex-1 cursor-pointer gap-4 overflow-hidden rounded-xl border bg-card p-3 transition-shadow hover:border-marque/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-marque"
    >
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-marque-fonce to-marque sm:w-44">
        {article.coverImageUrl && imgOk ? (
          <img
            src={article.coverImageUrl}
            alt={article.title}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        {article.category && (
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: article.category.color }}>
            {article.category.name}
          </span>
        )}
        <h3 className="line-clamp-3 font-bold leading-snug underline-offset-4 group-hover:underline sm:line-clamp-2">
          {article.title}
        </h3>
        <p className="text-xs text-muted-foreground">{timeAgo(article.publishedAt || article.createdAt)}</p>
      </div>
    </motion.article>
  )
}
