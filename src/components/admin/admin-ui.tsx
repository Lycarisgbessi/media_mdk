'use client'

// =====================================================================
// admin-ui.tsx — briques d'interface partagées du tableau de bord admin
// (PageHeader, StatCard, StatusBadge/DataBadge, EmptyState,
//  ConfirmAction/ConfirmDialog, SectionCard, ListSkeleton, errMessage)
// =====================================================================

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// ---------- Messages d'erreur ----------

export function errMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return 'Une erreur est survenue — veuillez réessayer'
}

// ---------- En-tête de page ----------

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

// ---------- Carte statistique (compteur animé) ----------

function useCountUp(value: number, started: boolean): number {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!started) return
    const duration = 700
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(value * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, started])
  return display
}

const ACCENTS = {
  marque: 'bg-marque-clair text-marque dark:bg-marque/15',
  jaune: 'bg-jaune-clair text-yellow-900 dark:text-jaune',
  rouge: 'bg-rouge-clair text-rouge',
} as const

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = 'marque',
}: {
  icon: LucideIcon
  label: string
  value: number
  hint?: string
  accent?: 'marque' | 'jaune' | 'rouge'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  const display = useCountUp(value, inView)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.3 }}
    >
      <Card className="h-full">
        <CardContent className="flex items-start gap-3 p-4">
          <div className={cn('rounded-lg p-2.5', ACCENTS[accent])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums">{display.toLocaleString('fr-FR')}</p>
            {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------- Badge de statut ----------

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  review: 'En relecture',
  approved: 'Approuvé',
  scheduled: 'Planifié',
  published: 'Publié',
  archived: 'Archivé',
  pending: 'En attente',
  rejected: 'Rejeté',
  spam: 'Spam',
  new: 'Nouveau',
  read: 'Lu',
  answered: 'Traité',
  live: 'En direct',
  ended: 'Terminé',
  cancelled: 'Annulé',
  confirmed: 'Confirmé',
  active: 'Actif',
  suspended: 'Suspendu',
  info: 'Info',
  urgent: 'Urgent',
}

const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
  review: 'bg-jaune-clair text-yellow-900 dark:text-jaune',
  pending: 'bg-jaune-clair text-yellow-900 dark:text-jaune',
  read: 'bg-jaune-clair text-yellow-900 dark:text-jaune',
  scheduled: 'border border-marque/40 bg-marque-clair text-marque dark:bg-marque/15',
  approved: 'bg-marque-clair text-marque dark:bg-marque/15',
  confirmed: 'bg-marque-clair text-marque dark:bg-marque/15',
  published: 'bg-marque text-white dark:text-primary-foreground',
  answered: 'bg-marque text-white dark:text-primary-foreground',
  rejected: 'bg-rouge-clair text-rouge',
  new: 'bg-rouge text-white',
  spam: 'bg-rouge text-white',
  urgent: 'bg-jaune text-yellow-950',
  info: 'bg-marque-clair text-marque dark:bg-marque/15',
  live: 'bg-rouge text-white',
  ended: 'bg-muted text-muted-foreground',
  cancelled: 'border border-rouge/40 bg-muted text-rouge',
  suspended: 'bg-rouge-clair text-rouge',
  active: 'bg-marque-clair text-marque dark:bg-marque/15',
}

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status
  const cls = STATUS_CLASSES[status] ?? 'bg-muted text-muted-foreground'
  return (
    <Badge className={cn('gap-1.5 whitespace-nowrap border-transparent font-medium', cls)}>
      {status === 'live' ? <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" /> : null}
      {label}
    </Badge>
  )
}

export { StatusBadge as DataBadge }

// ---------- État vide ----------

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="rounded-full bg-muted p-3">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="font-semibold">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

// ---------- Confirmation d'action (aucune action destructive immédiate) ----------

export function ConfirmAction({
  trigger,
  title,
  description,
  onConfirm,
  confirmLabel = 'Confirmer',
}: {
  trigger: ReactNode
  title: string
  description?: string
  onConfirm: () => void | Promise<void>
  confirmLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const handle = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch {
      // l'erreur est déjà notifiée par l'appelant — la boîte reste ouverte
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rouge text-white hover:bg-rouge/90"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              void handle()
            }}
          >
            {busy ? 'En cours…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ConfirmAction as ConfirmDialog }

// ---------- Carte de section ----------

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={className}>
      {title || actions ? (
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
            {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}

// ---------- Squelettes de chargement ----------

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label="Chargement en cours">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)} aria-busy="true" aria-label="Chargement en cours">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  )
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <Skeleton className="w-full rounded-xl" style={{ height }} aria-busy="true" />
}

// ---------- Petit bouton d'action réutilisable ----------

export function GhostAction({
  icon: Icon,
  label,
  onClick,
  title,
  disabled,
}: {
  icon: LucideIcon
  label?: string
  onClick: () => void
  title?: string
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={label ? 'sm' : 'icon'}
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-label={title || label}
    >
      <Icon className={label ? 'h-4 w-4 sm:mr-1.5' : 'h-4 w-4'} aria-hidden="true" />
      {label ? <span className="hidden sm:inline">{label}</span> : null}
    </Button>
  )
}
