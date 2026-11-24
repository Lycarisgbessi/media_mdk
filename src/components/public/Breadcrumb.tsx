'use client'

import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  onClick?: () => void
}

/**
 * Fil d'Ariane — dernier élément en gras, éléments intermédiaires cliquables.
 */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  if (!items.length) return null
  return (
    <nav aria-label="Fil d'Ariane" className={cn('flex flex-wrap items-center gap-1 text-xs text-muted-foreground', className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />}
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="min-h-[28px] rounded px-0.5 transition-colors hover:text-marque focus-visible:outline-2 focus-visible:outline-marque"
              >
                {item.label}
              </button>
            ) : (
              <span className={cn('px-0.5', isLast && 'font-semibold text-foreground')} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
