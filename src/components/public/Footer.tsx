'use client'

import { useEffect, useState } from 'react'
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Youtube,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { CategoryPayload, SocialLink } from '@/lib/types'
import { Separator } from '@/components/ui/separator'

function socialIconFor(platform: string): LucideIcon {
  const p = platform.toLowerCase()
  if (p.includes('twitter') || p === 'x') return Twitter
  if (p.includes('facebook')) return Facebook
  if (p.includes('instagram')) return Instagram
  if (p.includes('linkedin')) return Linkedin
  if (p.includes('youtube')) return Youtube
  return Mail
}

/**
 * Pied de page : marque + rubriques + modules + informations légales,
 * contact et réseaux sociaux. Fond sombre permanent.
 */
export function Footer() {
  const navigate = useAppStore((s) => s.navigate)
  const settings = useAppStore((s) => s.settings)
  const contactInfos = useAppStore((s) => s.contactInfos)
  const socialLinks = useAppStore((s) => s.socialLinks)
  const [rootCategories, setRootCategories] = useState<CategoryPayload[]>([])

  const fmActive = settings?.moduleFmActive ?? true
  const tvActive = settings?.moduleTvActive ?? true
  const year = new Date().getFullYear()

  useEffect(() => {
    let cancelled = false
    api
      .get<{ categories: CategoryPayload[] }>('/api/categories')
      .then((res) => {
        if (cancelled) return
        const all = Array.isArray(res.categories) ? res.categories : []
        // uniquement les rubriques actives et marquées « visibles dans le menu »
        setRootCategories(
          all.filter((c) => c.active !== false && c.visibleMenu !== false).slice(0, 6)
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const goPage = (slug: string) => navigate({ name: 'page', slug })

  return (
    <footer className="mt-auto bg-[#0D1512] text-white/80 dark:bg-black/40">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-12 lg:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* Marque */}
          <div className="sm:col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={() => navigate({ name: 'home' })}
              className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-jaune"
              aria-label="Retour à l'accueil"
            >
              <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-marque shadow-lg">
                {settings?.logoUrl?.trim() ? (
                  <img
                    src={settings.logoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                      if (fallback) fallback.style.display = 'block'
                    }}
                  />
                ) : null}
                <span
                  className="text-xl font-black text-white"
                  style={{ display: settings?.logoUrl?.trim() ? 'none' : 'block' }}
                >
                  M
                </span>
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0D1512] bg-rouge" aria-hidden="true" />
              </span>
              <span className="text-base font-black uppercase tracking-wider text-white">
                {settings?.siteName || 'Média'}
              </span>
            </button>
            {settings?.slogan && <p className="mt-3 text-xs uppercase tracking-widest text-jaune">{settings.slogan}</p>}
            {settings?.description && <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/60">{settings.description}</p>}

            {socialLinks.filter((s) => s.active).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {socialLinks.filter((s) => s.active).map((s: SocialLink) => {
                  const Icon = socialIconFor(s.platform)
                  return (
                    <a
                      key={s.id}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.platform}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-jaune hover:text-black"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )
                })}
              </div>
            )}

            {contactInfos.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm text-white/60">
                {contactInfos.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    {c.type === 'email' && <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-jaune" aria-hidden="true" />}
                    {c.type === 'phone' && <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-jaune" aria-hidden="true" />}
                    {c.type === 'address' && <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-jaune" aria-hidden="true" />}
                    <span>{c.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Rubriques */}
          <nav aria-label="Rubriques">
            <p className="text-xs font-bold uppercase tracking-widest text-white">Rubriques</p>
            <ul className="mt-4 space-y-1">
              {rootCategories.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ name: 'category', slug: cat.slug })}
                    className="flex min-h-[36px] w-full items-center gap-2 rounded px-1 text-left text-sm text-white/60 transition-colors hover:text-jaune"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden="true" />
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Modules */}
          <nav aria-label="Modules du média">
            <p className="text-xs font-bold uppercase tracking-widest text-white">Modules</p>
            <ul className="mt-4 space-y-1">
              {fmActive && (
                <li>
                  <button
                    type="button"
                    onClick={() => navigate({ name: 'fm' })}
                    className="min-h-[36px] w-full rounded px-1 text-left text-sm text-white/60 transition-colors hover:text-jaune"
                  >
                    Radio FM — podcasts
                  </button>
                </li>
              )}
              {tvActive && (
                <li>
                  <button
                    type="button"
                    onClick={() => navigate({ name: 'tv' })}
                    className="min-h-[36px] w-full rounded px-1 text-left text-sm text-white/60 transition-colors hover:text-jaune"
                  >
                    Chaîne TV — vidéos
                  </button>
                </li>
              )}
              {tvActive && (
                <li>
                  <button
                    type="button"
                    onClick={() => navigate({ name: 'live' })}
                    className="min-h-[36px] w-full rounded px-1 text-left text-sm text-white/60 transition-colors hover:text-jaune"
                  >
                    Directs
                  </button>
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'search', q: ' ' })}
                  className="min-h-[36px] w-full rounded px-1 text-left text-sm text-white/60 transition-colors hover:text-jaune"
                >
                  Recherche
                </button>
              </li>
            </ul>
          </nav>

          {/* Informations */}
          <nav aria-label="Informations légales">
            <p className="text-xs font-bold uppercase tracking-widest text-white">Informations</p>
            <ul className="mt-4 space-y-1">
              {[
                { label: 'À propos', slug: 'a-propos' },
                { label: 'Contact', slug: null },
                { label: 'Mentions légales', slug: 'mentions-legales' },
                { label: 'Confidentialité', slug: 'confidentialite' },
                { label: 'CGU', slug: 'cgu' },
                { label: 'Charte de modération', slug: 'moderation' },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => (item.slug ? goPage(item.slug) : navigate({ name: 'contact' }))}
                    className="min-h-[36px] w-full rounded px-1 text-left text-sm text-white/60 transition-colors hover:text-jaune"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Separator className="my-8 bg-white/10" />

        <div className="flex flex-col items-center justify-between gap-3 text-xs text-white/45 sm:flex-row">
          <p>
            © {year} {settings?.siteName || 'Média'} — Tous droits réservés.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <button type="button" onClick={() => goPage('mentions-legales')} className="transition-colors hover:text-jaune">
              Mentions légales
            </button>
            <button type="button" onClick={() => goPage('confidentialite')} className="transition-colors hover:text-jaune">
              Confidentialité
            </button>
            <button type="button" onClick={() => goPage('cgu')} className="transition-colors hover:text-jaune">
              CGU
            </button>
            <button type="button" onClick={() => navigate({ name: 'contact' })} className="transition-colors hover:text-jaune">
              Contact
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
