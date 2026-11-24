'use client'

// =====================================================================
// AdminUsers — gestion des comptes de la rédaction
// (création, édition, suspension/réactivation, suppression logique)
// =====================================================================

import { useCallback, useEffect, useState } from 'react'
import {
  Info,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { ROLE_LABELS, type UserPayload } from '@/lib/types'
import { formatDateTime } from '@/lib/helpers'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmAction, EmptyState, ListSkeleton, PageHeader, StatusBadge, errMessage } from './admin-ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface CreateForm {
  firstName: string
  lastName: string
  email: string
  role: string
  password: string
  bio: string
}

interface EditForm {
  firstName: string
  lastName: string
  role: string
  status: string
  bio: string
  password: string
}

const EMPTY_CREATE: CreateForm = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'journalist',
  password: '',
  bio: '',
}

function initialsOf(u: UserPayload): string {
  return `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase()
}

export default function AdminUsers() {
  const { toast } = useToast()
  const { session } = useAppStore()

  const [users, setUsers] = useState<UserPayload[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE)
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editSelf, setEditSelf] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: '',
    lastName: '',
    role: 'journalist',
    status: 'active',
    bio: '',
    password: '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api
      .get<{ users: UserPayload[] }>('/api/users')
      .then((d) => setUsers(d.users ?? []))
      .catch((err: unknown) => {
        setUsers([])
        toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
      })
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // ---- Création ----
  const submitCreate = async () => {
    const f = createForm
    if (!f.firstName.trim() || !f.lastName.trim()) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Le prénom et le nom sont requis.' })
      return
    }
    if (!EMAIL_RE.test(f.email.trim())) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Adresse email invalide.' })
      return
    }
    if (f.password.length < 8) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Mot de passe : 8 caractères minimum.' })
      return
    }
    setSaving(true)
    try {
      await api.post('/api/users', {
        email: f.email.trim(),
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        role: f.role,
        password: f.password,
        bio: f.bio || null,
      })
      toast({ title: 'Utilisateur créé', description: `${f.firstName.trim()} ${f.lastName.trim()}` })
      setCreateOpen(false)
      setCreateForm(EMPTY_CREATE)
      load()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  // ---- Édition ----
  const openEdit = (u: UserPayload) => {
    setEditId(u.id)
    setEditEmail(u.email)
    setEditSelf(session?.id === u.id)
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      status: u.status,
      bio: u.bio ?? '',
      password: '',
    })
    setEditOpen(true)
  }

  const submitEdit = async () => {
    if (!editId) return
    const f = editForm
    if (!f.firstName.trim() || !f.lastName.trim()) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Le prénom et le nom sont requis.' })
      return
    }
    if (f.password && f.password.length < 8) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Mot de passe : 8 caractères minimum.' })
      return
    }
    setSaving(true)
    try {
      await api.put(`/api/users/${editId}`, {
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        role: f.role,
        status: f.status,
        bio: f.bio || null,
        ...(f.password ? { password: f.password } : {}),
      })
      toast({ title: 'Utilisateur mis à jour', description: `${f.firstName.trim()} ${f.lastName.trim()}` })
      setEditOpen(false)
      load()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  // ---- Suspension / réactivation ----
  const toggleStatus = async (u: UserPayload) => {
    const status = u.status === 'active' ? 'suspended' : 'active'
    try {
      await api.put(`/api/users/${u.id}`, { status })
      toast({
        title: status === 'active' ? 'Utilisateur réactivé' : 'Utilisateur suspendu',
        description: `${u.firstName} ${u.lastName}`,
      })
      load()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
    }
  }

  // ---- Suppression logique ----
  const remove = async (u: UserPayload) => {
    try {
      await api.del(`/api/users/${u.id}`)
      toast({ title: 'Utilisateur supprimé', description: `${u.firstName} ${u.lastName} — suppression logique, récupérable en base.` })
      load()
    } catch (err: unknown) {
      toast({ variant: 'destructive', title: 'Erreur', description: errMessage(err) })
      throw err
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Utilisateurs"
        description="Comptes de la rédaction : rôles, statuts et double authentification."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="min-h-[44px]">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Nouvel utilisateur
          </Button>
        }
      />

      {!users ? (
        <ListSkeleton rows={6} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun utilisateur"
          description="Créez le premier compte de la rédaction."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Nouvel utilisateur
            </Button>
          }
        />
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto scroll-slim pr-1">
          {users.map((u) => {
            const isSelf = !!session && session.id === u.id
            return (
              <div
                key={u.id}
                className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-marque/40 md:flex-row md:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marque-clair text-sm font-bold text-marque dark:bg-marque/15"
                    aria-hidden="true"
                  >
                    {initialsOf(u)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {u.firstName} {u.lastName}
                      {isSelf ? (
                        <Badge variant="outline" className="ml-2 align-middle text-[10px] font-normal">
                          vous
                        </Badge>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      'border-transparent font-medium',
                      u.role === 'admin' ? 'bg-marque text-white' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Badge>
                  <StatusBadge status={u.status} />
                  {u.twofaEnabled ? (
                    <span className="inline-flex items-center gap-1 text-marque" title="Double authentification activée">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      <span className="text-[11px] font-medium">2FA</span>
                    </span>
                  ) : null}
                  <span className="text-[11px] text-muted-foreground">
                    Dernière connexion : {formatDateTime(u.lastLoginAt)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => openEdit(u)}
                    title={`Modifier ${u.firstName}`}
                    aria-label={`Modifier ${u.firstName}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    disabled={isSelf}
                    title={isSelf ? 'Vous ne pouvez pas modifier votre propre statut' : u.status === 'active' ? 'Suspendre le compte' : 'Réactiver le compte'}
                    aria-label={u.status === 'active' ? `Suspendre ${u.firstName}` : `Réactiver ${u.firstName}`}
                    onClick={() => void toggleStatus(u)}
                  >
                    {u.status === 'active' ? <UserX className="h-4 w-4" aria-hidden="true" /> : <UserCheck className="h-4 w-4" aria-hidden="true" />}
                  </Button>
                  <ConfirmAction
                    title="Supprimer cet utilisateur ?"
                    description={`« ${u.firstName} ${u.lastName} » sera supprimé (suppression logique — récupérable en base). Le compte ne pourra plus se connecter.`}
                    confirmLabel="Supprimer"
                    onConfirm={() => remove(u)}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-rouge hover:bg-rouge-clair hover:text-rouge"
                        disabled={isSelf}
                        title={isSelf ? 'Vous ne pouvez pas supprimer votre propre compte' : 'Supprimer l’utilisateur'}
                        aria-label={`Supprimer ${u.firstName}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    }
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        La double authentification (2FA) est gérée par chaque utilisateur depuis son profil.
      </p>

      {/* ---- Dialog création ---- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto scroll-slim">
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
            <DialogDescription>Créez un compte pour un membre de la rédaction.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nu-first">Prénom</Label>
                <Input
                  id="nu-first"
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder="Awa"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu-last">Nom</Label>
                <Input
                  id="nu-last"
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder="Diallo"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-email">Email *</Label>
              <Input
                id="nu-email"
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="awa.diallo@media.sn"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-pass">Mot de passe *</Label>
              <Input
                id="nu-pass"
                type="password"
                required
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground">minimum 8 caractères</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-bio">Bio (optionnelle)</Label>
              <Textarea
                id="nu-bio"
                rows={2}
                value={createForm.bio}
                onChange={(e) => setCreateForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Courte présentation du membre (visible sur sa page auteur)."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button disabled={saving} onClick={() => void submitCreate()} className="min-h-[44px]">
              {saving ? 'Création…' : 'Créer l’utilisateur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog édition ---- */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto scroll-slim">
          <DialogHeader>
            <DialogTitle>Modifier l’utilisateur</DialogTitle>
            <DialogDescription>{editEmail}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="eu-first">Prénom</Label>
                <Input
                  id="eu-first"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-last">Nom</Label>
                <Input
                  id="eu-last"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}
                disabled={editSelf}
              >
                <SelectTrigger className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                </SelectContent>
              </Select>
              {editSelf ? (
                <p className="text-xs text-muted-foreground">Vous ne pouvez pas modifier le statut de votre propre compte.</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-pass">Nouveau mot de passe (optionnel)</Label>
              <Input
                id="eu-pass"
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground">Laisser vide pour ne pas changer — minimum 8 caractères sinon.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-bio">Bio</Label>
              <Textarea
                id="eu-bio"
                rows={2}
                value={editForm.bio}
                onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button disabled={saving} onClick={() => void submitEdit()} className="min-h-[44px]">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
