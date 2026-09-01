# NearLoy - Project Map

## Current product shape

NearLoy is a loyalty and subscription platform with six active surfaces:

- Client mobile app for end users, exposed through the historical `(twa)` route group and Capacitor-friendly mobile auth entry points.
- Nearloy Hunt (`NH`) social city game: GPS/place-bound posts, Nearloy likes, Influence currency, boxes, cute collectible creature cards and missions.
- Public company cards at `/wallet/[slug]`.
- Public marketing, mobile-app, FAQ, giveaway, careers, Max and verified company intake pages.
- Company portal for partner operations, billing, media, staff, cashier and compliance.
- Admin portal for operations, payments, tasks, system health, analytics, growth, database map, backups, audit, support and verification.
- Local Next route handlers for public/admin/company adjunct workflows that sit next to the Nest REST API.

The runtime is a monorepo:

```text
nearloy/
  apps/api/              # NestJS REST API
  prisma/                # Prisma schema, migrations, seed
  src/app/(auth)/        # Login/register/email confirmation
  src/app/business/      # Public business landing, giveaway and rules
  src/app/careers/       # Public careers index and vacancy detail pages
  src/app/company/       # Public company registration and verification intake
  src/app/faq/           # Public FAQ hub and audience-specific FAQ pages
  src/app/mobile-app/    # APK/mobile product landing
  src/app/(twa)/         # Client mobile routes (historical folder name)
  src/app/(twa)/hunt/    # Nearloy Hunt mobile game surface
  src/app/(portal)/      # Admin/company desktop portal routes
  src/app/api/           # Next route handlers for web-adjacent API flows
  src/components/        # UI, brand, client components
  src/lib/api/           # Typed API clients
  src/lib/company-media-storage.ts # Runtime media storage helper for company vitrines
  docs/                  # Architecture, CI/CD, deployment docs
  scripts/               # Railway and local developer helpers
```

## Runtime entry points

- Web dev: `npm run dev:web`
- API dev: `npm run api:dev`
- Combined local dev: `npm run dev:local`
- Local DB: `npm run db:local:up`
- Full verification: `npm run ci:verify`
- Railway-aware build: `npm run build`
- Railway-aware start: `npm run start`

## Important app routes

Client app:

- `/app` dashboard with points balance, active subscriptions and loyalty cards. The root `/` is a public product entry point.
- `/onboarding` first-run tutorial with skip support.
- `/companies` all partners with category and price/filter UX.
- `/categories/[slug]` category-specific partner listing.
- `/loyalty-cards` companies where the user has earned points.
- `/marketplace` subscription catalog from DB.
- `/marketplace/[id]` subscription details and activation.
- `/wallet/[slug]` company loyalty card. Authenticated clients can favorite/use actions; guests see a public read-only showcase with levels, gallery, offers and NearLoy CTA.
- `/map` and `/map/full` Yandex map with branches, clustering, route presets, user location and filters.
- `/history` activity + archived subscriptions.
- `/scan` QR screen.
- `/hunt` Nearloy Hunt social city game: tutorial, post creation, feed, missions, Influence, boxes and Hunt Cards.
- `/settings` profile, favorites, promo/referral and subpages for account, statuses, rewards, reviews, personalization, partnership and company referrals.
- `/payment/success` and `/payment/success/[...rest]` provider return screens for subscription and bundle payments.
- `/season-pass` experimental subscription/gamification surface.

Admin:

- `/admin` dashboard.
- `/admin/ai` permission-scoped admin AI assistant for operational questions, safe proposals and confirmed actions.
- `/admin/tasks`, `/admin/tasks/[uuid]` operational Kanban, task detail, assignment and archive workflow.
- `/admin/users`, `/admin/users/[uuid]`, `/admin/users/[uuid]/permissions` user operations and granular permissions.
- `/admin/users/[uuid]/relations`, `/admin/users/[uuid]/security`, `/admin/users/[uuid]/activity` detailed user relationship, security and activity views.
- `/admin/categories` category dictionary.
- `/admin/companies` and `/admin/companies/[uuid]` company users, profile, locations and subscriptions.
- `/admin/companies/[uuid]/clients` company client analytics.
- `/admin/companies/[uuid]/payments` company payment ledger and recent billing payments.
- `/admin/companies/[uuid]/security` company staff/security overview.
- `/admin/companies/[uuid]/referral` company PR/referral attribution.
- `/admin/company-verifications` and `/admin/company-verifications/[uuid]` verified partner intake review.
- `/admin/leads` and `/admin/leads/[uuid]` landing lead inbox with Telegram delivery history.
- `/admin/telegram` admin Telegram direct-message connection.
- `/admin/support` support-only workspace.
- `/admin/finance` finance operations, approval queue, YooKassa test payouts, manual payout closure and company/PR balance coverage.
- `/admin/subscriptions` KPI/SLA/forecast analytics.
- `/admin/profile-statuses` profile status catalog and icon set.
- `/admin/growth` promo codes and referral campaign rules.
- `/admin/pr`, `/admin/pr/funnel`, `/admin/pr/companies`, `/admin/pr/payouts`, `/admin/pr/settings` PR acquisition funnel, company attribution and payout workspace.
- `/admin/database` interactive Prisma schema visualizer.
- `/admin/audit`, `/admin/audit/new`, `/admin/audit/backups` audit and DB backups.
- `/admin/payments` YooKassa payment ledger with search, filters, status sync context and unfinished payment links.
- `/admin/system-health` critical alert cockpit fed by system/task sources.
- `/admin/company-billing-promos` company billing promo codes.
- `/admin/compliance` future compliance module.
- `/admin/test-screens/*` design lab screens for gamification experiments.

Public:

- `/` public product entry page.
- `/landing` dark NearLoy marketing landing with Telegram-backed contact form.
- `/faq`, `/faq/clients`, `/faq/business` public FAQ hub and audience-specific FAQs.
- `/business` company-facing marketing landing with partner CTA and giveaway entry.
- `/business/giveaway` 100 000 RUB business-development giveaway with active-company progress vessel and use-case cards.
- `/business/giveaway/rules` giveaway participation rules for Russian companies.
- `/careers` localized NearLoy careers hub with SEO metadata and role cards.
- `/careers/[slug]` generic vacancy detail pages.
- `/careers/b2b-manager` detailed B2B acquisition manager vacancy with Telegram contact CTA.
- `/company/register` multi-step company account request and verification form.
- `/mobile-app` mobile app/APK landing.
- `/mobile-map` public/mobile map entry surface.
- `/max` Max messenger entry/landing surface.
- `/requisites` PR payout requisites helper page.
- `/wallet/[slug]` public read-only company card for sharing outside the app.

Company portal:

- `/company` dashboard with access warning when NearLoy subscription is inactive.
- `/company/clients` cashier/customer workspace.
- `/company/team` staff and local roles.
- `/company/subscriptions` plans and entitlement rules.
- `/company/club` partner subscriptions and bundles.
- `/company/finance`, `/company/payments` finance and payout request surfaces.
- `/company/billing` NearLoy subscription payment, promo, YooKassa and saved method controls.
- `/company/settings`, `/company/settings/locations`, `/company/settings/media`, `/company/settings/offers`, `/company/settings/socials` profile, addresses, public media, offers and social links.
- `/company/compliance`, `/company/getting-started`.

## Key files

- `prisma/schema.prisma` - source of truth for relational schema.
- `prisma/seed.mjs` - professional demo seed data.
- `apps/api/src/admin/admin.controller.ts` - admin API surface.
- `apps/api/src/admin/admin.service.ts` - admin business logic.
- `apps/api/src/registered/registered.controller.ts` - client app API surface.
- `apps/api/src/registered/registered.service.ts` - DB-backed mobile read models.
- `apps/api/src/hunt/*` - Nearloy Hunt server-side economy, posts, likes, boxes, cards and missions.
- `apps/api/src/auth/auth.service.ts` - auth, sessions, account freeze/reactivation.
- `apps/api/src/oauth/*` - VK ID OAuth start/callback/session/link/unlink flow.
- `apps/api/src/email/email.service.ts` - production-safe email delivery through Resend/SMTP fallback and message ledger.
- `apps/api/src/ai-gateway/*` - protected OpenAI Responses gateway for local development environments that cannot call OpenAI directly.
- `apps/api/src/payments/*` - YooKassa checkout, webhook/status sync, payment expiration and saved method encryption.
- `apps/api/src/maintenance/*` - restore-time maintenance lock.
- `src/middleware.ts` - web route UX redirection based on JWT role/expiry; API remains the security boundary.
- `src/app/(portal)/admin/tasks/*` - admin operations Kanban and task detail workflow.
- `src/app/(portal)/admin/ai/page.tsx` - admin AI chat UI with permission-scoped context and optional image attachment.
- `src/lib/admin-ai/*` - modular admin AI context, OpenAI integration, permissions and safe action application.
- `src/lib/finance/payout-operations.ts` and `src/lib/finance/yookassa-payouts.ts` - payout target resolution, checklist/coverage and YooKassa payout integration.
- `src/app/business/*` - business landing, giveaway progress and rules pages.
- `src/app/careers/*` - localized careers pages, role definitions and vacancy SEO metadata.
- `src/components/landing/MarketingHeader.tsx` and `MarketingFooter.tsx` - shared public landing navigation/footer.
- `src/app/(portal)/admin/payments/page.tsx` - provider payment ledger.
- `src/app/(portal)/admin/system-health/page.tsx` - critical incident cockpit.
- `src/app/(portal)/admin/database/page.tsx` - visual DB map synced with Prisma models.
- `src/app/(portal)/admin/growth/page.tsx` - promo/referral admin UI.
- `src/app/(portal)/admin/pr/*` - PR funnel, attributed companies, payout requests and settings.
- `src/app/(portal)/admin/company-verifications/*` - company verification review and passport cleanup.
- `src/app/(portal)/admin/leads/*` - landing lead processing and Telegram retry UI.
- `src/app/(portal)/admin/telegram/page.tsx` - Telegram admin linking screen.
- `src/app/(portal)/admin/companies/[uuid]/page.tsx` - company profile, addresses and subscriptions.
- `src/app/(portal)/company/settings/media/page.tsx` - company logo, hero, gallery and special offers.
- `src/app/(portal)/company/settings/socials/page.tsx` - public company social links.
- `src/app/(portal)/company/settings/offers/page.tsx` - special-offer management entry.
- `src/app/(twa)/wallet/[id]/page.tsx` - client/public company card by uuid or slug.
- `src/app/(twa)/hunt/page.tsx` - Nearloy Hunt mobile game UI.
- `src/app/api/public/company-media/[slug]/route.ts` - public media/offers payload for company cards.
- `src/app/(twa)/map/page.tsx` - Yandex Maps integration and location UX.
- `src/lib/i18n/*` - portable RU/EN dictionaries, locale detection and persistence.
- `src/lib/telegram/*` - Telegram client, webhook handlers, admin linking and delivery tests.
- `src/lib/max/*` - Max Mini App authentication/linking helpers and webhook handling.
- `src/lib/api/admin-client.ts`, `src/lib/api/twa-client.ts`, `src/lib/api/auth-client.ts` - frontend API clients.
- `.github/workflows/nearloy-ci-cd.yml` - PR verification and production migration gate.

## Local and production environments

- Local development should use Docker PostgreSQL from `docker-compose.yml`.
- Production DB credentials live in Railway variables and GitHub Secrets, not in committed files.
- PRs run full checks against a temporary GitHub Actions PostgreSQL service.
- Pushes to `main` run the same checks and then apply production Prisma migrations.
- Railway deploys `nearloy-api` and `nearloy-web` from `main`.

## Notes

- User-facing client surfaces are DB-backed through `/api/registered/*`; `mockData` is legacy/static fallback only.
- There are two API layers: the Nest API under `apps/api/src/*` for core REST resources and local Next route handlers under `src/app/api/*` for web-adjacent workflows such as public media, admin AI, Telegram/Max webhooks and company media/social settings.
- Points are company-scoped. Promo/referral point rewards require a company context and write normal loyalty ledger rows.
- Company addresses are stored as `CompanyLocation` with coordinates, hours and active/main flags.
- Company verification creates a user first and then links/activates company access after admin approval.
- Passport photos are encrypted in local private storage and removed after approve/reject cleanup.
- Admin UI uses one global language switcher in the navigation shell; page strings are moving into structured dictionaries.
- Subscription and company billing payments use YooKassa checkout. Successful provider payments are stored in `Payment` and activate the subscription or billing invoice after status sync/webhook confirmation.
- Pending YooKassa payments have a 15-minute payment window. Active pending payments are reused to prevent duplicate orders; expired pending payments are finalized as unsuccessful.
- Saved company YooKassa methods store only encrypted provider method identifiers and card metadata; NearLoy does not store card data.
- Finance payouts can be sent through the YooKassa test payout gateway or closed manually after a real external transfer. Manual closure stays available for the launch model.
- Admin AI is modular and permission-scoped. It may answer, summarize and prepare supported safe actions, but never expands an operator's permissions.
- OAuth/VK ID lives alongside password, Telegram Mini App and Max Mini App auth; linked accounts are stored in `OAuthAccount` with state/ticket rows for browser handoff.
- Dedicated Nearloy Hunt docs live in `docs/hunt/`.
- Nearloy Hunt is web2-first. Cards are collectible game objects; any future NFT minting must be optional and separate from the first-run user flow.
- Hunt economy is server-authoritative: clients can create posts and reactions, but Influence, box grants, card rolls and mission rewards are written by Nest transactions.
- Protected auth pages use fetch-level session recovery: on expired access tokens the UI shows a recovery overlay and attempts refresh before redirecting.
- Daily Telegram reports can be delivered by `scripts/daily-report-scheduler.mjs` at the configured Moscow time.
- Company media currently uses runtime/local storage. Production needs persistent volume or external object storage before heavy real-world media usage.
- Recent merged PR context is tracked in `docs/project-map/recent-prs.md`.
