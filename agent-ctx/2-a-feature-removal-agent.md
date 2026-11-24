# Task 2-a — Removal of "Blocs d'accueil" (admin) and "Newsletter" (everywhere)

## Files modified
- `src/components/admin/AdminShell.tsx` — removed nav entries `newsletter` + `blocks`, imports `AdminNewsletter`/`AdminBlocks`/`Mail`/`LayoutTemplate`, and `case 'newsletter'` / `case 'blocks'` branches.
- `src/components/admin/AdminDashboard.tsx` — removed StatCard "Abonnés newsletter" + unused `Users` icon import.
- `src/components/admin/AdminBackup.tsx` — export contents entry is now `'Messages de contact'` (newsletter mention removed).
- `src/components/admin/AdminSettings.tsx` — removed "Newsletter activée" Switch block and `newsletterEnabled` from Général save payload.
- `src/components/admin/admin-ui.tsx` — removed now-orphaned `unsubscribed` entries from STATUS_LABELS / STATUS_BADGES maps (only consumer was AdminNewsletter).
- `src/components/public/Footer.tsx` — deleted `FooterNewsletter`, the footer newsletter section, and unused imports (Loader2, Send, Button, Input, useToast).
- `src/components/public/HomeView.tsx` — removed `b-news` fallback block, `newsletter` label, `NewsletterInline` component, `case 'newsletter'` branch, unused imports (CheckCircle2, Send, Input, and pre-existing unused Eye).
- `src/components/public/CategoryView.tsx` — deleted `NewsletterCompact`, its sidebar usage, updated doc comment; unused imports removed (CheckCircle2, Mail, Send, Input).
- `src/app/api/stats/route.ts` — removed newsletterSubscribers count query + response field.
- `src/app/api/export/route.ts` — removed `db.newsletterSubscriber.findMany` + `subscribers` field.
- `src/app/api/_lib/media-helpers.ts` — comment cleanup only (newsletter mention in header).
- `src/lib/types.ts` — removed `NewsletterSubscriberPayload`, `newsletterSubscribers` from DashboardStats, `newsletterEnabled` from SiteSettings + DEFAULT_SETTINGS.

## Files deleted
- `src/components/admin/AdminBlocks.tsx`
- `src/components/admin/AdminNewsletter.tsx`
- `src/components/public/NewsletterBlock.tsx`
- `src/app/api/newsletter/` (route.ts, [id]/route.ts, confirm/route.ts, unsubscribe/route.ts)

## Intentionally NOT touched (per spec)
- `/api/homepage-blocks` backend, `homepageBlocks` store field, `/api/settings` route, `HomeView` block-rendering logic, `HomepageBlockItem` type + its "Blocs d'accueil" comment in types.ts (public homepage still renders seeded blocks).
- prisma schema, seed, db:push, AdminArticles/AdminAds/AdminFlash/ArticleView/helpers.ts/store.ts, api/ads/*, api/upload/*.
- Remaining "blocs d'accueil" mentions (settings route comment, types.ts section comment) refer to the kept public homepage-blocks feature, not the removed admin UI.

## Verification
- Greps clean in src: newsletter, Newsletter*, AdminNewsletter, AdminBlocks, 'blocks' (in src/components/admin), subscriber, unsubscribed, api/newsletter.
- `bun run lint`: 0 errors. `tsc --noEmit`: no errors in src (only pre-existing examples/ + skills/ errors unrelated to this task).
- Dev server compiles and serves `/` with 200s.
