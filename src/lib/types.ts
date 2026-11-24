// =====================================================================
// Types partagés — Plateforme Média (types sérialisés API, dates = ISO)
// =====================================================================

// ---------- Navigation SPA ----------
export type View =
  | { name: 'home' }
  | { name: 'category'; slug: string }
  | { name: 'article'; slug: string }
  | { name: 'fm' }
  | { name: 'show'; slug: string }
  | { name: 'episode'; slug: string }
  | { name: 'tv' }
  | { name: 'video'; id: string }
  | { name: 'live'; id?: string }
  | { name: 'search'; q: string }
  | { name: 'author'; id: string }
  | { name: 'tag'; slug: string }
  | { name: 'contact' }
  | { name: 'page'; slug: string }
  | { name: 'login' }
  | { name: 'admin'; section?: string; id?: string }

// ---------- Utilisateurs ----------
export interface UserPayload {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'editor_in_chief' | 'journalist' | 'audio_producer' | 'video_manager' | 'moderator' | 'ad_manager'
  avatarUrl?: string | null
  bio?: string | null
  status: string
  twofaEnabled: boolean
  lastLoginAt?: string | null
  createdAt: string
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  editor_in_chief: 'Rédacteur en chef',
  journalist: 'Journaliste',
  audio_producer: 'Producteur audio (FM)',
  video_manager: 'Responsable vidéo (TV)',
  moderator: 'Modérateur',
  ad_manager: 'Gestionnaire publicité',
}

// ---------- Réglages du site ----------
export interface SiteSettings {
  siteName: string
  slogan: string
  description: string
  logoUrl: string
  logoDarkUrl: string
  primaryColor: string
  accentColor: string
  actionColor: string
  moduleFmActive: boolean
  moduleTvActive: boolean
  timezone: string
  language: string
  commentsEnabled: boolean
  maintenanceMode: boolean
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  analyticsScript: string
  adsTxt: string
  seoAssistantEnabled: boolean
  aiAssistantEnabled: boolean
  minSeoScore: number
  dataSavingMode: boolean
}

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'MÉDIA',
  slogan: "L'information qui compte, en continu",
  description: 'Plateforme d\'information généraliste : articles, podcasts (FM) et vidéos (TV).',
  logoUrl: '',
  logoDarkUrl: '',
  primaryColor: '#0E7C3F',
  accentColor: '#F2C200',
  actionColor: '#D92632',
  moduleFmActive: true,
  moduleTvActive: true,
  timezone: 'Atlantic/Reykjavik',
  language: 'fr',
  commentsEnabled: true,
  maintenanceMode: false,
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  analyticsScript: '',
  adsTxt: '',
  seoAssistantEnabled: true,
  aiAssistantEnabled: true,
  minSeoScore: 0,
  dataSavingMode: false,
}

// ---------- Contact / réseaux sociaux ----------
export interface ContactInfo {
  id: string
  label: string
  value: string
  type: 'phone' | 'email' | 'address' | 'hours'
}

export interface SocialLink {
  id: string
  platform: string
  url: string
  active: boolean
}

// ---------- Rubriques ----------
export interface CategoryPayload {
  id: string
  parentId?: string | null
  name: string
  slug: string
  description?: string | null
  color: string
  icon?: string | null
  imageUrl?: string | null
  order: number
  visibleMenu: boolean
  visibleHome: boolean
  metaTitle?: string | null
  metaDescription?: string | null
  active: boolean
  children?: CategoryPayload[]
  _count?: { articles: number; audioContents: number; videos: number }
}

// ---------- Articles ----------
export interface ArticlePayload {
  id: string
  type: string
  title: string
  subtitle?: string | null
  slug: string
  lede?: string | null
  content: string
  coverImageUrl?: string | null
  coverCaption?: string | null
  coverCredit?: string | null
  categoryId?: string | null
  category?: CategoryPayload | null
  authorId?: string | null
  author?: { id: string; firstName: string; lastName: string; role: string; bio?: string | null; avatarUrl?: string | null } | null
  status: 'draft' | 'review' | 'approved' | 'scheduled' | 'published' | 'archived' | string
  publishedAt?: string | null
  scheduledAt?: string | null
  isFeatured: boolean
  featuredRank?: number | null
  commentsOpen: boolean
  readingTime: number
  views: number
  metaTitle?: string | null
  metaDescription?: string | null
  metaKeywords?: string | null
  ogImageUrl?: string | null
  fontId?: string | null
  seoScore: number
  language: string
  createdAt: string
  updatedAt: string
  tags?: TagPayload[]
}

export interface TagPayload {
  id: string
  name: string
  slug: string
}

// ---------- Flash info ----------
export interface FlashInfoPayload {
  id: string
  text: string
  link?: string | null
  level: 'info' | 'urgent' | 'live' | string
  active: boolean
  startsAt?: string | null
  endsAt?: string | null
}

// ---------- FM (audio) ----------
export type AudioType = 'podcast' | 'chronique' | 'reportage_audio' | 'episode'

export interface AudioShowPayload {
  id: string
  name: string
  slug: string
  description?: string | null
  coverImageUrl?: string | null
  hostNames?: string | null
  categoryId?: string | null
  driveFolderUrl?: string | null
  order: number
  active: boolean
  schedule?: AudioSchedulePayload[]
  _count?: { contents: number }
}

export interface AudioSchedulePayload {
  id: string
  day: string
  time: string
  recurrence: string
  active: boolean
}

export interface AudioContentPayload {
  id: string
  type: AudioType | string
  title: string
  slug: string
  description?: string | null
  categoryId?: string | null
  category?: CategoryPayload | null
  authorId?: string | null
  author?: { id: string; firstName: string; lastName: string } | null
  showId?: string | null
  show?: AudioShowPayload | null
  googleDriveFileId?: string | null
  googleDriveUrl?: string | null
  duration: number
  coverImageUrl?: string | null
  status: string
  publishedAt?: string | null
  scheduledAt?: string | null
  season?: number | null
  episodeNumber?: number | null
  transcription?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  metaKeywords?: string | null
  seoScore: number
  views: number
  createdAt: string
  tags?: TagPayload[]
}

// ---------- TV (vidéo) ----------
export interface VideoPayload {
  id: string
  articleId?: string | null
  title: string
  youtubeUrl: string
  youtubeId: string
  thumbnailUrl?: string | null
  duration?: number | null
  description?: string | null
  type: 'reportage' | 'replay' | 'extrait' | string
  categoryId?: string | null
  category?: CategoryPayload | null
  authorId?: string | null
  author?: { id: string; firstName: string; lastName: string } | null
  status: string
  publishedAt?: string | null
  scheduledAt?: string | null
  order: number
  transcription?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  seoScore: number
  views: number
  createdAt: string
}

export interface LiveStreamPayload {
  id: string
  title: string
  description?: string | null
  youtubeUrl: string
  youtubeId: string
  thumbnailUrl?: string | null
  status: 'scheduled' | 'live' | 'ended' | 'cancelled' | string
  scheduledStart?: string | null
  actualStart?: string | null
  actualEnd?: string | null
  categoryId?: string | null
  featured: boolean
  views: number
}

// ---------- Commentaires ----------
export interface CommentPayload {
  id: string
  articleId?: string | null
  audioId?: string | null
  videoId?: string | null
  parentId?: string | null
  authorName: string
  content: string
  status: 'pending' | 'approved' | 'rejected' | 'spam' | string
  reports: number
  createdAt: string
  replies?: CommentPayload[]
  article?: { title: string; slug: string } | null
  audio?: { title: string; slug: string } | null
  video?: { title: string; id: string } | null
}

// ---------- Publicité ----------
export interface AdCreativePayload {
  id: string
  slotId: string
  slotKey?: string
  advertiserId?: string | null
  advertiserName?: string | null
  name: string
  imageUrl?: string | null
  htmlCode?: string | null
  linkUrl?: string | null
  weight: number
  active: boolean
  startsAt?: string | null
  endsAt?: string | null
  impressions: number
  clicks: number
}

export interface AdSlotPayload {
  id: string
  key: string
  name: string
  placement: string
  active: boolean
  width?: number | null
  height?: number | null
}

// ---------- Blocs d'accueil ----------
export interface HomepageBlockItem {
  id: string
  type: string
  title?: string | null
  source?: string | null
  order: number
  active: boolean
}

// ---------- Autres ----------
export interface ContactMessagePayload {
  id: string
  name: string
  email: string
  phone?: string | null
  subject: string
  message: string
  attachmentUrl?: string | null
  status: string
  note?: string | null
  createdAt: string
}

export interface TypographyOptionPayload {
  id: string
  name: string
  cssFamily: string
  usage: string
  active: boolean
  order: number
}

export interface PagePayload {
  id: string
  slug: string
  title: string
  content: string
  metaTitle?: string | null
  metaDescription?: string | null
  updatedAt: string
}

export interface AuditLogPayload {
  id: string
  userId?: string | null
  userName?: string | null
  action: string
  entity: string
  entityId?: string | null
  data?: string | null
  createdAt: string
}

export interface DashboardStats {
  todayViews: number
  totalArticles: number
  publishedArticles: number
  totalAudio: number
  totalVideos: number
  pendingComments: number
  unreadMessages: number
  pendingArticles: number
  activeLives: number
  topArticles: { id: string; title: string; slug: string; views: number }[]
  topAudio: { id: string; title: string; slug: string; views: number }[]
  topVideos: { id: string; title: string; id2: string; views: number }[]
  viewsByDay: { day: string; count: number }[]
  byCategory: { name: string; count: number }[]
}

// ---------- Types de contenu (repères visuels) ----------
export const CONTENT_TYPE_LABELS: Record<string, string> = {
  article: 'Article',
  analyse: 'Analyse',
  interview: 'Interview',
  tribune: 'Tribune',
  chronique: 'Chronique',
  podcast: 'Podcast',
  chronique_audio: 'Chronique audio',
  reportage_audio: 'Reportage audio',
  episode: 'Épisode',
  reportage: 'Reportage',
  replay: 'Replay',
  extrait: 'Extrait',
  live: 'Direct',
}

export const ARTICLE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  review: 'En relecture',
  approved: 'Approuvé',
  scheduled: 'Planifié',
  published: 'Publié',
  archived: 'Archivé',
}
