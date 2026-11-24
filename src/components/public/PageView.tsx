'use client'

// =====================================================================
// PageView — pages institutionnelles (À propos, Mentions légales…)
// =====================================================================

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, FileQuestion, Home, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api-client'
import { formatDate, markdownToHtml } from '@/lib/helpers'
import { useAppStore } from '@/lib/store'
import type { PagePayload } from '@/lib/types'

export function PageView({ slug }: { slug: string }) {
  const navigate = useAppStore((s) => s.navigate)
  const [page, setPage] = useState<PagePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    api
      .get<{ page: PagePayload }>(`/api/pages/${encodeURIComponent(slug)}`)
      .then((d) => setPage(d.page))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
        <Skeleton className="h-2 w-16 rounded-full" />
        <Skeleton className="mt-4 h-9 w-2/3" />
        <div className="mt-8 space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !page) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rouge-clair">
          <FileQuestion className="h-7 w-7 text-rouge" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Page introuvable</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
        <div className="mt-5 flex gap-3">
          <Button className="rounded-full bg-marque text-white hover:bg-marque-fonce" onClick={() => navigate({ name: 'home' })}>
            <Home className="h-4 w-4" />
            Retour à l&apos;accueil
          </Button>
          <Button variant="outline" className="rounded-full" onClick={load} disabled={loading}>
            <RotateCw className="h-4 w-4" />
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <header>
          <span aria-hidden="true" className="block h-1.5 w-14 rounded-full bg-jaune" />
          <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">{page.title}</h1>
        </header>

        <div
          className="article-body mt-8"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(page.content) }}
        />

        <footer className="mt-10 flex items-center gap-1.5 border-t pt-4 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          Dernière mise à jour : {formatDate(page.updatedAt)}
        </footer>
      </motion.div>
    </div>
  )
}

export default PageView
