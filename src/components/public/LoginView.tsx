'use client'

// =====================================================================
// LoginView — espace professionnel : connexion + double authentification
// (2FA de démonstration) avec indice de comptes visible
// =====================================================================

import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import type { UserPayload } from '@/lib/types'

const DEMO_ACCOUNTS =
  'admin@media.fr / redaction@media.fr / journaliste@media.fr / fm@media.fr / tv@media.fr / moderation@media.fr / pub@media.fr'

export function LoginView() {
  const setSession = useAppStore((s) => s.setSession)
  const navigate = useAppStore((s) => s.navigate)
  const { toast } = useToast()

  const [step, setStep] = useState<'credentials' | 'twofa'>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submitCredentials = (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    api
      .post<{ user: UserPayload }>('/api/auth/login', { email: email.trim(), password })
      .then((d) => finishLogin(d.user))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401 && err.message === '2FA_REQUIRED') {
          setStep('twofa')
          setError('')
          return
        }
        setError(err instanceof ApiError ? err.message : 'Connexion impossible, réessayez.')
      })
      .finally(() => setLoading(false))
  }

  const submitCode = (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    setError('')
    if (code.trim().length !== 6) {
      setError('Le code comporte 6 chiffres.')
      return
    }
    setLoading(true)
    api
      .post<{ user: UserPayload }>('/api/auth/login', { email: email.trim(), password, code: code.trim() })
      .then((d) => finishLogin(d.user))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Code invalide, réessayez.')
      })
      .finally(() => setLoading(false))
  }

  const finishLogin = (user: UserPayload) => {
    setSession(user)
    toast({ title: `Bienvenue ${user.firstName} !` })
    navigate({ name: 'admin' })
  }

  return (
    <div className="flex min-h-[72vh] items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
          {/* Logo */}
          <div className="flex flex-col items-center text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-marque text-2xl font-black text-white shadow-md">
              M
            </div>
            <h1 className="mt-4 text-xl font-bold">Espace professionnel</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Tableau de bord de la rédaction</p>
          </div>

          {step === 'credentials' ? (
            <form className="mt-6 space-y-4" onSubmit={submitCredentials} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Adresse e-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom.nom@media.fr"
                    className="min-h-[44px] pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="min-h-[44px] pl-9 pr-11"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-rouge">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full min-h-[44px] rounded-full bg-marque font-semibold text-white hover:bg-marque-fonce"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Se connecter
              </Button>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={submitCode} noValidate>
              <div className="flex flex-col items-center text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-marque-clair text-marque-fonce dark:text-foreground">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h2 className="mt-3 font-bold">Vérification en deux étapes</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Saisissez le code à 6 chiffres envoyé à {email}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-code" className="sr-only">
                  Code de vérification
                </Label>
                <Input
                  id="login-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="min-h-[52px] text-center text-2xl font-bold tracking-[0.5em]"
                />
              </div>

              {error && <p className="text-center text-sm text-rouge">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full min-h-[44px] rounded-full bg-marque font-semibold text-white hover:bg-marque-fonce"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Vérifier
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep('credentials')
                  setCode('')
                  setError('')
                }}
                className="flex min-h-[44px] w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Revenir à la connexion
              </button>
            </form>
          )}

          {/* Indice de démonstration */}
          <div className="mt-6 rounded-lg bg-jaune-clair p-3 text-xs leading-relaxed dark:bg-jaune-clair">
            <p className="font-semibold">Environnement de démonstration</p>
            <p className="mt-1 text-foreground/80">
              Comptes : {DEMO_ACCOUNTS}
              <br />
              Mot de passe : <span className="font-semibold">media2026</span> — code 2FA :{' '}
              <span className="font-semibold">246810</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate({ name: 'home' })}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au site
        </button>
      </motion.div>
    </div>
  )
}

export default LoginView
