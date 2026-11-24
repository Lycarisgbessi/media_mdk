'use client'

import { Eye } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import type { ArticlePayload } from '@/lib/types'

/** Format compact français des vues : 12 400 → « 12,4 k ». */
export function formatViewsFr(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n < 1000) return String(n)
  if (n < 10000) {
    const v = (n / 1000).toFixed(1).replace('.', ',').replace(',0', '')
    return `${v} k`
  }
  return `${Math.round(n / 1000)} k`
}

/**
 * Bloc « Les plus consultés » : liste numérotée 1 → 6.
 */
export function MostReadBlock({ articles }: { articles: ArticlePayload[] }) {
  const navigate = useAppStore((s) => s.navigate)
  if (!articles.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4 }}
    >
      <ol className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
        {articles.slice(0, 6).map((a, i) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => navigate({ name: 'article', slug: a.slug })}
              className="group flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-marque"
              aria-label={`Lire : ${a.title}`}
            >
              <span className="w-7 shrink-0 text-2xl font-bold leading-none text-marque/30 transition-colors group-hover:text-marque/60" aria-hidden="true">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-sm font-semibold leading-snug underline-offset-2 group-hover:underline">
                  {a.title}
                </span>
                <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" aria-hidden="true" />
                  {formatViewsFr(a.views)} vues
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </motion.div>
  )
}
