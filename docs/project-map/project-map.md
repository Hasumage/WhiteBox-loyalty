# NearLoy - Project Map

## Current product shape

NearLoy is a loyalty marketplace with four active surfaces:

- TWA/mobile client app for end users.
- Public landing and verified company intake.
- Admin portal for operations, analytics, growth, database map, backups, audit, support and verification.
- Company portal placeholder for partner-facing finance/compliance flows.

The runtime is a monorepo:

```text
nearloy/
  apps/api/              # NestJS REST API
  prisma/                # Prisma schema, migrations, seed
  src/app/(auth)/        # Login/register/email confirmation
  src/app/company/       # Public company registration and verification intake
  src/app/(twa)/         # Mobile app routes
  src/app/(portal)/      # Admin/company desktop portal routes
  src/components/        # UI, brand, TWA components
  src/lib/api/           # Typed API clients
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

TWA/mobile:

- `/` dashboard with points balance, active subscriptions and loyalty cards.
- `/onboarding` first-run tutorial with skip support.
- `/companies` all partners with category and price/filter UX.
- `/loyalty-cards` companies where the user has earned points.
- `/marketplace` subscription catalog from DB.
- `/marketplace/[id]` subscription details and activation.
- `/wallet/[id]` company loyalty card, levels, subscriptions and addresses.
- `/map` Yandex map with branches, clustering, route presets, user location and filters.
- `/history` activity + archived subscriptions.
- `/scan` QR screen.
- `/settings` profile, favorites, promo/referral and subpages.
- `/season-pass` experimental subscription/gamification surface.

Admin:

- `/admin` dashboard.
- `/admin/users`, `/admin/users/[uuid]`, `/admin/users/[uuid]/permissions` user operations and granular permissions.
- `/admin/categories` category dictionary.
- `/admin/companies` and `/admin/companies/[uuid]` company users, profile, locations and subscriptions.
- `/admin/companies/[uuid]/clients` company client analytics.
- `/admin/company-verifications` and `/admin/company-verifications/[uuid]` verified partner intake review.
- `/admin/leads` and `/admin/leads/[uuid]` landing lead inbox with Telegram delivery history.
- `/admin/telegram` admin Telegram direct-message connection.
- `/admin/support` support-only workspace.
- `/admin/finance` finance operations and approval workflow placeholder.
- `/admin/subscriptions` KPI/SLA/forecast analytics.
- `/admin/growth` promo codes and referral campaign rules.
- `/admin/database` interactive Prisma schema visualizer.
- `/admin/audit`, `/admin/audit/new`, `/admin/audit/backups` audit and DB backups.
- `/admin/payments`, `/admin/compliance` placeholders for future operational modules.
- `/admin/test-screens/*` design lab screens for gamification experiments.

Public:

- `/landing` dark NearLoy marketing landing with Telegram-backed contact form.
- `/company/register` multi-step company account request and verification form.

Company portal:

- `/company`, `/company/payments`, `/company/compliance`.

## Key files

- `prisma/schema.prisma` - source of truth for relational schema.
- `prisma/seed.mjs` - professional demo seed data.
- `apps/api/src/admin/admin.controller.ts` - admin API surface.
- `apps/api/src/admin/admin.service.ts` - admin business logic.
- `apps/api/src/registered/registered.controller.ts` - client/TWA API surface.
- `apps/api/src/registered/registered.service.ts` - DB-backed mobile read models.
- `apps/api/src/auth/auth.service.ts` - auth, sessions, account freeze/reactivation.
- `apps/api/src/maintenance/*` - restore-time maintenance lock.
- `src/middleware.ts` - web route UX redirection based on JWT role/expiry; API remains the security boundary.
- `src/app/(portal)/admin/database/page.tsx` - visual DB map synced with Prisma models.
- `src/app/(portal)/admin/growth/page.tsx` - promo/referral admin UI.
- `src/app/(portal)/admin/company-verifications/*` - company verification review and passport cleanup.
- `src/app/(portal)/admin/leads/*` - landing lead processing and Telegram retry UI.
- `src/app/(portal)/admin/telegram/page.tsx` - Telegram admin linking screen.
- `src/app/(portal)/admin/companies/[uuid]/page.tsx` - company profile, addresses and subscriptions.
- `src/app/(twa)/map/page.tsx` - Yandex Maps integration and location UX.
- `src/lib/i18n/*` - portable RU/EN dictionaries, locale detection and persistence.
- `src/lib/telegram/*` - Telegram client, webhook handlers, admin linking and delivery tests.
- `src/lib/api/admin-client.ts`, `src/lib/api/twa-client.ts`, `src/lib/api/auth-client.ts` - frontend API clients.
- `.github/workflows/nearloy-ci-cd.yml` - PR verification and production migration gate.

## Local and production environments

- Local development should use Docker PostgreSQL from `docker-compose.yml`.
- Production DB credentials live in Railway variables and GitHub Secrets, not in committed files.
- PRs run full checks against a temporary GitHub Actions PostgreSQL service.
- Pushes to `main` run the same checks and then apply production Prisma migrations.
- Railway deploys `nearloy-api` and `nearloy-web` from `main`.

## Notes

- User-facing TWA surfaces are DB-backed through `/api/registered/*`; `mockData` is legacy/static fallback only.
- Points are company-scoped. Promo/referral point rewards require a company context and write normal loyalty ledger rows.
- Company addresses are stored as `CompanyLocation` with coordinates, hours and active/main flags.
- Company verification creates a user first and then links/activates company access after admin approval.
- Passport photos are encrypted in local private storage and removed after approve/reject cleanup.
- Admin UI uses one global language switcher in the navigation shell; page strings are moving into structured dictionaries.
- Subscription and company billing payments use YooKassa checkout. Successful provider payments are stored in `Payment` and activate the subscription or billing invoice after status sync/webhook confirmation.
