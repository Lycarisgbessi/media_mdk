'use client'

// =====================================================================
// ContactView — coordonnées de la rédaction + formulaire de contact
// validé en temps réel (pièce jointe par lien, consentement, honeypot)
// =====================================================================

import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Music2,
  Phone,
  Send,
  Twitter,
  Youtube,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import type { ContactInfo, SocialLink } from '@/lib/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+0-9 ().-]{6,20}$/

const SUBJECTS = ['Rédaction', 'Publicité', 'Droit de réponse', 'Autre'] as const

const INFO_ICONS: Record<ContactInfo['type'], typeof Phone> = {
  phone: Phone,
  email: Mail,
  address: MapPin,
  hours: Clock,
}

const SOCIAL_ICONS: Record<string, typeof Globe> = {
  facebook: Facebook,
  twitter: Twitter,
  x: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music2,
}

function SocialButton({ link }: { link: SocialLink }) {
  const key = link.platform.toLowerCase().trim()
  const Icon = SOCIAL_ICONS[key] || Globe
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={link.platform}
      title={link.platform}
      className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-foreground/80 shadow-sm transition hover:-translate-y-0.5 hover:bg-marque-clair hover:text-marque-fonce hover:shadow-md dark:hover:text-foreground"
    >
      <Icon className="h-5 w-5" />
    </a>
  )
}

export function ContactView() {
  const contactInfos = useAppStore((s) => s.contactInfos)
  const socialLinks = useAppStore((s) => s.socialLinks)
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // honeypot anti-spam
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const nameError = name.trim().length < 2 ? 'Indiquez votre nom (2 caractères minimum).' : ''
  const emailError = !EMAIL_RE.test(email.trim()) ? 'Adresse e-mail invalide.' : ''
  const phoneError = phone.trim() && !PHONE_RE.test(phone.trim()) ? 'Numéro de téléphone invalide.' : ''
  const subjectError = !subject ? 'Choisissez un sujet.' : ''
  const messageError =
    message.trim().length < 10 ? 'Votre message est trop court (10 caractères minimum).' : ''
  const consentError = !consent ? 'Votre consentement est requis pour envoyer le message.' : ''

  const valid =
    !nameError && !emailError && !phoneError && !subjectError && !messageError && !consentError

  const markTouched = (field: string) => setTouched((t) => ({ ...t, [field]: true }))

  const showIf = (field: string, error: string) => (touched[field] && error ? error : '')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched({ name: true, email: true, phone: true, subject: true, message: true, consent: true })
    // Honeypot rempli → robot : abandon silencieux
    if (website.trim()) return
    if (!valid || submitting) return
    setSubmitting(true)
    api
      .post('/api/contact', {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        subject,
        message: message.trim(),
        attachmentUrl: attachmentUrl.trim() || undefined,
        // vérifications côté serveur : honeypot + consentement RGPD
        website: website.trim() ? website.trim() : undefined,
        consent,
      })
      .then(() => setSent(true))
      .catch((err: unknown) => {
        toast({
          title: "Échec de l'envoi",
          description: err instanceof ApiError ? err.message : 'Une erreur est survenue, réessayez.',
          variant: 'destructive',
        })
      })
      .finally(() => setSubmitting(false))
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setPhone('')
    setSubject('')
    setMessage('')
    setAttachmentUrl('')
    setConsent(false)
    setTouched({})
    setSent(false)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-marque text-white shadow-md">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Nous contacter</h1>
            <p className="text-sm text-muted-foreground">
              Une question, une information, un droit de réponse ? Écrivez-nous.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]">
          {/* Coordonnées */}
          <aside aria-label="Coordonnées" className="space-y-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Coordonnées</h2>
              <div className="mt-3">
                {contactInfos.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Les coordonnées seront affichées ici une fois renseignées dans le tableau de bord (aucune
                    donnée par défaut).
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {contactInfos.map((info) => {
                      const Icon = INFO_ICONS[info.type] || Globe
                      return (
                        <li key={info.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-marque-clair text-marque-fonce dark:text-foreground">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {info.label}
                            </span>
                            <span className="block break-words text-sm font-medium">{info.value}</span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            {socialLinks.filter((l) => l.active).length > 0 && (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Suivez-nous
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {socialLinks
                    .filter((l) => l.active)
                    .map((link) => (
                      <SocialButton key={link.id} link={link} />
                    ))}
                </div>
              </div>
            )}
          </aside>

          {/* Formulaire */}
          <div>
            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                className="flex flex-col items-center rounded-2xl border bg-card p-10 text-center"
              >
                <CheckCircle2 className="h-14 w-14 text-marque" />
                <h2 className="mt-4 text-xl font-bold">Message envoyé !</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nous revenons vers vous sous 48 h ouvrées.
                </p>
                <Button variant="outline" className="mt-5 rounded-full" onClick={resetForm}>
                  Envoyer un autre message
                </Button>
              </motion.div>
            ) : (
              <form onSubmit={submit} noValidate className="rounded-2xl border bg-card p-5 md:p-6">
                {/* Honeypot anti-spam — invisible pour les humains */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Site web
                    <input
                      type="text"
                      name="website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-name">Nom *</Label>
                    <Input
                      id="contact-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => markTouched('name')}
                      placeholder="Votre nom complet"
                      autoComplete="name"
                      aria-invalid={!!showIf('name', nameError)}
                      className="min-h-[44px]"
                    />
                    {showIf('name', nameError) && <p className="text-xs text-rouge">{nameError}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email">E-mail *</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => markTouched('email')}
                      placeholder="vous@exemple.fr"
                      autoComplete="email"
                      aria-invalid={!!showIf('email', emailError)}
                      className="min-h-[44px]"
                    />
                    {showIf('email', emailError) && <p className="text-xs text-rouge">{emailError}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-phone">Téléphone (facultatif)</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => markTouched('phone')}
                      placeholder="06 12 34 56 78"
                      autoComplete="tel"
                      aria-invalid={!!showIf('phone', phoneError)}
                      className="min-h-[44px]"
                    />
                    {showIf('phone', phoneError) && <p className="text-xs text-rouge">{phoneError}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-subject">Sujet *</Label>
                    <Select
                      value={subject}
                      onValueChange={(v) => {
                        setSubject(v)
                        markTouched('subject')
                      }}
                    >
                      <SelectTrigger id="contact-subject" aria-invalid={!!showIf('subject', subjectError)} className="min-h-[44px] w-full">
                        <SelectValue placeholder="Choisir un sujet" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECTS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {showIf('subject', subjectError) && <p className="text-xs text-rouge">{subjectError}</p>}
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="contact-message">Message *</Label>
                    <span className={`text-xs ${message.length > 5000 ? 'text-rouge' : 'text-muted-foreground'}`}>
                      {message.length}/5000
                    </span>
                  </div>
                  <Textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onBlur={() => markTouched('message')}
                    placeholder="Décrivez votre demande…"
                    rows={6}
                    maxLength={5000}
                    aria-invalid={!!showIf('message', messageError)}
                  />
                  {showIf('message', messageError) && <p className="text-xs text-rouge">{messageError}</p>}
                </div>

                <div className="mt-4 space-y-1.5">
                  <Label htmlFor="contact-attachment">Lien de la pièce jointe (Cloudinary) — facultatif</Label>
                  <Input
                    id="contact-attachment"
                    type="url"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    placeholder="https://res.cloudinary.com/…"
                    className="min-h-[44px]"
                  />
                </div>

                <div className="mt-4 space-y-1.5">
                  <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg text-sm">
                    <Checkbox
                      checked={consent}
                      onCheckedChange={(v) => {
                        setConsent(v === true)
                        markTouched('consent')
                      }}
                      className="mt-0.5"
                      aria-invalid={!!showIf('consent', consentError)}
                    />
                    <span>J&apos;accepte que mes données soient utilisées pour traiter ma demande.</span>
                  </label>
                  {showIf('consent', consentError) && <p className="text-xs text-rouge">{consentError}</p>}
                </div>

                <div className="mt-5">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="h-12 min-h-[44px] rounded-full bg-marque px-8 font-semibold text-white hover:bg-marque-fonce"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Envoyer le message
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default ContactView
