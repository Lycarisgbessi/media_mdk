'use client'

import { useState } from 'react'
import { Headphones, Newspaper, Play, Clock, CalendarDays } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { timeAgo } from '@/lib/helpers'

export interface ContentCardProps {
  kind: 'article' | 'audio' | 'video'
  title: string
  /** Article/audio : slug. Vidéo : ID de la vidéo. */
  slug: string
  imageUrl?: string | null
  category?: { name: string; color: string } | null
  /** Temps de lecture / durée / nom d'émission */
  meta?: string | null
  date?: string | null
  variant?: 'default' | 'large' | 'compact' | 'horizontal'
  onView?: () => void
  /** Chapô (variante large uniquement) */
  lede?: string | null
}

const TYPE_BADGE: Record<ContentCardProps['kind'], { icon: typeof Newspaper; classes: string; label: string }> = {
  article: { icon: Newspaper, classes: 'bg-marque text-white', label: 'Article' },
  audio: { icon: Headphones, classes: 'bg-jaune text-black', label: 'Audio' },
  video: { icon: Play, classes: 'bg-rouge text-white', label: 'Vidéo' },
}

/**
 * Carte de contenu réutilisable (articles, épisodes FM, vidéos TV).
 * Image 16:9 avec dégradé de secours, badge de type, survol animé.
 */
export function ContentCard({
  kind,
  title,
  slug,
  imageUrl,
  category,
  meta,
  date,
  variant = 'default',
  onView,
  lede,
}: ContentCardProps) {
  const navigate = useAppStore((s) => s.navigate)
  const [imgOk, setImgOk] = useState(true)
  const badge = TYPE_BADGE[kind]
  const BadgeIcon = badge.icon

  const open = () => {
    if (onView) return onView()
    if (kind === 'article') navigate({ name: 'article', slug })
    else if (kind === 'audio') navigate({ name: 'episode', slug })
    else navigate({ name: 'video', id: slug })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  // ---------- Variante compacte : ligne fine (listes denses) ----------
  if (variant === 'compact') {
    return (
      <motion.article
        role="button"
        tabIndex={0}
        aria-label={title}
        onClick={open}
        onKeyDown={onKeyDown}
        whileHover={{ x: 3 }}
        transition={{ duration: 0.2 }}
        className="group flex cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-marque"
      >
        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-marque-fonce to-marque">
          {imageUrl && imgOk ? (
            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              onError={() => setImgOk(false)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <BadgeIcon className="h-5 w-5 text-white/70" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {category ? `${category.name} · ` : ''}
            {date ? timeAgo(date) : ''}
          </p>
        </div>
      </motion.article>
    )
  }

  // ---------- Variante horizontale : vignette à gauche ----------
  if (variant === 'horizontal') {
    return (
      <motion.article
        role="button"
        tabIndex={0}
        aria-label={title}
        onClick={open}
        onKeyDown={onKeyDown}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.25 }}
        className="group flex cursor-pointer gap-4 overflow-hidden rounded-xl border bg-card p-3 transition-shadow hover:border-marque/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-marque sm:p-4"
      >
        <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-marque-fonce to-marque sm:w-40">
          {imageUrl && imgOk ? (
            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              onError={() => setImgOk(false)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <BadgeIcon className="h-7 w-7 text-white/70" />
            </div>
          )}
          <span
            className={cn(
              'absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm',
              badge.classes
            )}
          >
            <BadgeIcon className="h-3 w-3" />
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {category && (
            <span className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: category.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
              {category.name}
            </span>
          )}
          <h3 className="line-clamp-2 font-semibold leading-snug decoration-marque decoration-2 underline-offset-4 group-hover:underline">
            {title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {meta && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {meta}
              </span>
            )}
            {date && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {timeAgo(date)}
              </span>
            )}
          </div>
        </div>
      </motion.article>
    )
  }

  // ---------- Variantes default / large : image 16:9 au-dessus ----------
  const isLarge = variant === 'large'
  return (
    <motion.article
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={open}
      onKeyDown={onKeyDown}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:border-marque/40 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-marque"
    >
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-marque-fonce to-marque">
        {imageUrl && imgOk ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BadgeIcon className={cn('text-white/60', isLarge ? 'h-12 w-12' : 'h-9 w-9')} />
          </div>
        )}
        <span
          className={cn(
            'absolute left-2 top-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm',
            badge.classes
          )}
        >
          <BadgeIcon className="h-3 w-3" />
          {badge.label}
        </span>
      </div>

      <div className={cn('flex flex-1 flex-col', isLarge ? 'p-5 sm:p-6' : 'p-4')}>
        {category && (
          <span className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: category.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
            {category.name}
          </span>
        )}
        <h3
          className={cn(
            'font-bold leading-snug decoration-marque decoration-2 underline-offset-4 group-hover:underline',
            isLarge ? 'text-xl sm:text-2xl line-clamp-3' : 'line-clamp-2'
          )}
        >
          {title}
        </h3>
        {isLarge && lede && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{lede}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {meta && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {meta}
            </span>
          )}
          {date && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {timeAgo(date)}
            </span>
          )}
        </div>
      </div>
    </motion.article>
  )
}
