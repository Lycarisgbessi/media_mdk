'use client'

// =====================================================================
// CommentsSection — liste des commentaires approuvés (arbre) + dépôt
// public avec validation temps réel et réponses à 1 niveau
// =====================================================================

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Flag, Loader2, MessageSquare, RotateCw, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { api, qs } from '@/lib/api-client'
import { ApiError } from '@/lib/api-client'
import type { CommentPayload } from '@/lib/types'
import { timeAgo } from '@/lib/helpers'
import { useToast } from '@/hooks/use-toast'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const AVATAR_STYLES = [
  'bg-marque text-white',
  'bg-jaune text-black',
  'bg-rouge text-white',
  'bg-teal-600 text-white',
]

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

function colorOf(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 9973
  return AVATAR_STYLES[hash % AVATAR_STYLES.length]
}

function countComments(list: CommentPayload[]): number {
  return list.reduce((acc, c) => acc + 1 + (c.replies ? countComments(c.replies) : 0), 0)
}

interface CommentItemProps {
  comment: CommentPayload
  onReply: (comment: CommentPayload) => void
  depth?: number
}

function CommentItem({ comment, onReply, depth = 0 }: CommentItemProps) {
  const { toast } = useToast()
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl p-1"
    >
      <div className="flex gap-3">
        <div
          aria-hidden="true"
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${colorOf(comment.authorName)}`}
        >
          {initialsOf(comment.authorName) || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">{comment.authorName}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
            {comment.content}
          </p>
          <div className="mt-1.5 flex items-center gap-4">
            {depth === 0 && (
              <button
                type="button"
                onClick={() => onReply(comment)}
                className="min-h-[32px] text-xs font-semibold text-marque hover:underline"
              >
                Répondre
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                // Signalement réel : incrémenté côté API, visible en modération
                api
                  .post(`/api/comments/${comment.id}`, { action: 'report' })
                  .then(() => toast({ title: 'Commentaire signalé à la modération' }))
                  .catch(() =>
                    toast({ title: 'Signalement impossible pour le moment', variant: 'destructive' })
                  )
              }}
              className="flex min-h-[32px] items-center gap-1 text-xs text-muted-foreground transition hover:text-rouge"
            >
              <Flag className="h-3 w-3" />
              Signaler
            </button>
          </div>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-4 mt-3 space-y-4 border-l-2 border-border pl-4">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} onReply={onReply} depth={depth + 1} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

export interface CommentsSectionProps {
  contentType: string
  contentId: string
}

export function CommentsSection({ contentType, contentId }: CommentsSectionProps) {
  const { toast } = useToast()
  const [comments, setComments] = useState<CommentPayload[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<CommentPayload | null>(null)
  const [authorName, setAuthorName] = useState('')
  const [authorEmail, setAuthorEmail] = useState('')
  const [content, setContent] = useState('')
  const [touched, setTouched] = useState({ name: false, email: false, content: false })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    api
      .get<{ comments: CommentPayload[] }>(`/api/comments${qs({ contentType, contentId })}`)
      .then((d) => setComments(d.comments || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [contentType, contentId])

  useEffect(() => {
    load()
  }, [load])

  const nameError = authorName.trim().length < 2 ? 'Indiquez votre nom (2 caractères minimum).' : ''
  const emailError = !EMAIL_RE.test(authorEmail.trim()) ? 'Adresse e-mail invalide.' : ''
  const contentError =
    content.trim().length < 3 ? 'Votre message est trop court (3 caractères minimum).' : ''
  const canSubmit = !nameError && !emailError && !contentError && !submitting
  const total = countComments(comments)

  const openReply = (comment: CommentPayload) => {
    setReplyTo(comment)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setReplyTo(null)
    setTouched({ name: false, email: false, content: false })
  }

  const submit = () => {
    if (submitting) return
    setTouched({ name: true, email: true, content: true })
    if (!canSubmit) return
    setSubmitting(true)
    api
      .post('/api/comments', {
        contentType,
        contentId,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim(),
        content: content.trim(),
        parentId: replyTo?.id || undefined,
      })
      .then(() => {
        toast({ title: 'Merci ! Votre commentaire sera publié après modération.' })
        setAuthorName('')
        setAuthorEmail('')
        setContent('')
        closeForm()
      })
      .catch((err: unknown) => {
        toast({
          title: "Échec de l'envoi",
          description: err instanceof ApiError ? err.message : 'Une erreur est survenue.',
          variant: 'destructive',
        })
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <section aria-label="Commentaires" className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <MessageSquare className="h-5 w-5 text-marque" />
        Commentaires ({loading ? '…' : total})
      </h2>

      {/* Dépôt d'un commentaire */}
      <div className="mt-4">
        {!formOpen ? (
          <Button variant="outline" className="rounded-full" onClick={() => setFormOpen(true)}>
            <MessageSquare className="h-4 w-4" />
            Donner votre avis
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-card p-4"
          >
            {replyTo && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-marque-clair px-3 py-1.5 text-xs dark:bg-marque-clair">
                <span className="font-medium text-marque-fonce dark:text-foreground">
                  En réponse à {replyTo.authorName}
                </span>
                <button
                  type="button"
                  aria-label="Annuler la réponse"
                  onClick={() => setReplyTo(null)}
                  className="ml-auto grid h-6 w-6 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="comment-name">Nom *</Label>
                <Input
                  id="comment-name"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                  placeholder="Votre nom"
                  autoComplete="name"
                  className="min-h-[44px]"
                />
                {touched.name && nameError && <p className="text-xs text-rouge">{nameError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comment-email">E-mail *</Label>
                <Input
                  id="comment-email"
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="vous@exemple.fr"
                  autoComplete="email"
                  className="min-h-[44px]"
                />
                {touched.email && emailError && <p className="text-xs text-rouge">{emailError}</p>}
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="comment-content">Votre message *</Label>
                <span className={`text-xs ${content.length > 2000 ? 'text-rouge' : 'text-muted-foreground'}`}>
                  {content.length}/2000
                </span>
              </div>
              <Textarea
                id="comment-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, content: true }))}
                placeholder="Restez courtois et constructif…"
                rows={4}
                maxLength={2000}
              />
              {touched.content && contentError && <p className="text-xs text-rouge">{contentError}</p>}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={submit} disabled={submitting} className="min-h-[44px] rounded-full bg-marque text-white hover:bg-marque-fonce">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publier
              </Button>
              <Button variant="ghost" className="min-h-[44px] rounded-full" onClick={closeForm}>
                Annuler
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Liste */}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">Impossible de charger les commentaires.</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={load}>
              <RotateCw className="h-4 w-4" />
              Réessayer
            </Button>
          </div>
        ) : total === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Soyez le premier à réagir à ce contenu.
          </p>
        ) : (
          <div className="space-y-5">
            {comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} onReply={openReply} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default CommentsSection
