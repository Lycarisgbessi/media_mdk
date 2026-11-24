'use client'

// =====================================================================
// RichEditor — éditeur visuel (WYSIWYG) du contenu d'article.
// Ce qui est tapé s'affiche tel quel : le gras est vu en gras, l'italique
// en italique, les intertitres en titres — plus aucun balisage à retenir,
// plus d'onglet « aperçu ».
//
// - Image : importation directe depuis l'appareil (sélecteur de fichiers,
//   glisser-déposer ou collage) → téléversement → insertion dans le texte.
// - Vidéo : coller un lien YouTube → intégration immédiate dans le texte.
// - Audio : intégration d'un épisode FM par son slug (lecteur sur la page
//   publique).
// Le contenu est stocké en HTML ; le markdown historique est converti à
// l'ouverture par le composant parent via markdownToHtml.
// =====================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Mic,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
  Youtube as YoutubeIcon,
} from 'lucide-react'
import { parseYouTubeId } from '@/lib/helpers'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { errMessage } from './admin-ui'

interface RichEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  onImageUploadingChange?: (busy: boolean) => void
}

/** Téléverse un fichier image vers /api/upload et renvoie son URL publique. */
async function uploadImageFile(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body })
  const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || 'Téléversement impossible')
  }
  return data.url
}

const isImageFile = (f: File | null | undefined) => !!f && f.type.startsWith('image/')

export function RichEditor({
  value,
  onChange,
  placeholder = 'Rédigez votre article… Le gras, l’italique et les titres s’affichent directement.',
  disabled = false,
  onImageUploadingChange,
}: RichEditorProps) {
  const { toast } = useToast()
  const editorRef = useRef<Editor | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const setUploadingBusy = useCallback(
    (busy: boolean) => {
      setUploading(busy)
      onImageUploadingChange?.(busy)
    },
    [onImageUploadingChange],
  )

  // ---- Import d'image depuis l'appareil ----
  const insertUploadedImage = useCallback(
    async (file: File) => {
      const ed = editorRef.current
      if (!ed) return
      setUploadingBusy(true)
      try {
        const url = await uploadImageFile(file)
        ed.chain().focus().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, '') }).run()
        toast({ title: 'Image insérée', description: file.name })
      } catch (err: unknown) {
        toast({
          title: 'Import impossible',
          description: err instanceof Error ? err.message : errMessage(err),
          variant: 'destructive',
        })
      } finally {
        setUploadingBusy(false)
      }
    },
    [setUploadingBusy, toast],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        width: 800,
        height: 450,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'rich-content min-h-[380px] max-w-none px-4 py-4 focus:outline-none',
        'aria-label': 'Contenu de l’article',
      },
      // Collage d'une image copiée depuis l'appareil → import direct
      handlePaste: (_view, event) => {
        const image = Array.from(event.clipboardData?.files ?? []).find(isImageFile)
        if (!image) return false
        event.preventDefault()
        void insertUploadedImage(image)
        return true
      },
      // Glisser-déposer d'une image → import direct
      handleDrop: (_view, event, _slice, moved) => {
        if (!moved && !event.dataTransfer?.files?.length) return false
        const image = Array.from(event.dataTransfer?.files ?? []).find(isImageFile)
        if (!image) return false
        event.preventDefault()
        void insertUploadedImage(image)
        return true
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML())
    },
  })

  // Référence stable pour les gestionnaires d'événements de l'éditeur.
  editorRef.current = editor

  // Synchronisation contenu externe → éditeur (chargement d'un article
  // existant). Pendant l'édition (éditeur actif), on n'écrase JAMAIS le
  // contenu : cela interdit tout effacement de ce qui vient d'être saisi ou
  // inséré (vidéo, image) par une valeur obsolète.
  useEffect(() => {
    if (!editor) return
    if (editor.isFocused || editor.isDestroyed) return
    const current = editor.getHTML()
    if ((value || '<p></p>') !== current) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  // ---- Vidéo YouTube par lien ----
  const insertYouTube = useCallback(() => {
    const ed = editorRef.current
    if (!ed) return
    const url = window.prompt('Collez le lien de la vidéo YouTube (watch, youtu.be, shorts, live) :')
    if (!url) return
    if (!parseYouTubeId(url)) {
      toast({
        title: 'Lien YouTube invalide',
        description: 'Formats acceptés : watch?v=, youtu.be/, shorts/, live/',
        variant: 'destructive',
      })
      return
    }
    ed.commands.setYoutubeVideo({ src: url, width: 800, height: 450 })
  }, [toast])

  // ---- Épisode audio FM ----
  const insertAudio = useCallback(() => {
    const ed = editorRef.current
    if (!ed) return
    const slug = window.prompt("Slug de l'épisode audio FM à intégrer (ex. matinale-12-mars) :")
    if (!slug) return
    ed.chain().focus().insertContent(`<p>[AUDIO:${slug.trim()}]</p>`).run()
  }, [])

  const addLink = useCallback(() => {
    const ed = editorRef.current
    if (!ed) return
    const url = window.prompt('Adresse du lien (interne : /fm, /tv… ou complète https://…) :')
    if (!url) return
    const safe = /^(https?:\/\/|\/)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`
    if (ed.state.selection.empty) {
      ed.chain().focus().setLink({ href: safe }).insertContent('Lien').run()
      return
    }
    ed.chain().focus().extendMarkRange('link').setLink({ href: safe }).run()
  }, [])

  const btn = (
    key: string,
    label: string,
    title: string,
    active: boolean,
    onClick: () => void,
    Icon: typeof Bold,
  ) => (
    <button
      key={key}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={!editor || disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-[36px] items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors',
        active ? 'bg-marque text-white' : 'text-muted-foreground hover:bg-background hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="hidden md:inline">{label}</span>
    </button>
  )

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      {/* ---- Barre d'outils : mise en forme immédiate ---- */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/50 p-1.5" role="toolbar" aria-label="Mise en forme du contenu">
        {btn('bold', 'Gras', 'Gras (Ctrl+B)', editor?.isActive('bold') ?? false, () => editor?.chain().focus().toggleBold().run(), Bold)}
        {btn('italic', 'Italique', 'Italique (Ctrl+I)', editor?.isActive('italic') ?? false, () => editor?.chain().focus().toggleItalic().run(), Italic)}
        {btn('underline', 'Souligné', 'Souligné (Ctrl+U)', editor?.isActive('underline') ?? false, () => editor?.chain().focus().toggleUnderline().run(), UnderlineIcon)}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        {btn('h2', 'Intertitre', 'Intertitre (grand titre de section)', editor?.isActive('heading', { level: 2 }) ?? false, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), Heading2)}
        {btn('h3', 'Sous-titre', 'Sous-titre de section', editor?.isActive('heading', { level: 3 }) ?? false, () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), Heading3)}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        {btn('quote', 'Citation', 'Citation', editor?.isActive('blockquote') ?? false, () => editor?.chain().focus().toggleBlockquote().run(), Quote)}
        {btn('bullets', 'Liste', 'Liste à puces', editor?.isActive('bulletList') ?? false, () => editor?.chain().focus().toggleBulletList().run(), List)}
        {btn('olist', 'Liste numérotée', 'Liste numérotée', editor?.isActive('orderedList') ?? false, () => editor?.chain().focus().toggleOrderedList().run(), ListOrdered)}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        {btn('link', 'Lien', 'Insérer un lien', editor?.isActive('link') ?? false, addLink, Link2)}
        {btn(
          'image',
          uploading ? 'Import…' : 'Image',
          uploading ? 'Import en cours…' : 'Importer une image depuis l’appareil',
          false,
          () => imageInputRef.current?.click(),
          ImagePlus,
        )}
        {btn('youtube', 'Vidéo', 'Intégrer une vidéo YouTube', editor?.isActive('youtube') ?? false, insertYouTube, YoutubeIcon)}
        {btn('audio', 'Audio', 'Intégrer un épisode audio FM', false, insertAudio, Mic)}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        {btn('undo', 'Annuler', 'Annuler (Ctrl+Z)', false, () => editor?.chain().focus().undo().run(), Undo2)}
        {btn('redo', 'Rétablir', 'Rétablir (Ctrl+Y)', false, () => editor?.chain().focus().redo().run(), Redo2)}
      </div>

      <EditorContent editor={editor} />

      {uploading ? (
        <p className="border-t bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground" role="status">
          Import de l’image en cours…
        </p>
      ) : null}

      {/* Sélecteur de fichiers : import direct depuis la mémoire de l'appareil */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // permet de re-sélectionner le même fichier
          if (file) void insertUploadedImage(file)
        }}
      />
    </div>
  )
}
