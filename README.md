# NearLoy - Loyalty, subscriptions and company operations

Monorepo: **Next.js** client/company/admin UI + **NestJS** REST API + **Prisma** + **PostgreSQL**.

## Prerequisites

- Node.js 20+
- PostgreSQL (local or remote)
- Copy `.env.example` -> `.env` and set `DATABASE_URL`, `JWT_SECRET`, etc.

## Install

```bash
npm install
npx prisma generate
```

## Local database

Use a local PostgreSQL database for development:

```bash
copy .env.example .env
npm run db:local:up
npm run db:migrate:dev
npm run db:seed
```

See `docs/local-development.md` for the full local setup.

## Run the web app (port 3000)

```bash
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000).

## Run the API (port 3001)

```bash
npm run api:dev
```

- Swagger: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- Health: `GET /api/health`

## API Overview

Auth routes (`/api/auth/*`):

- `POST /api/auth/register/request-code` - request registration email code
- `POST /api/auth/register/verify` - verify email code and create/confirm account
- `POST /api/auth/register` - blocked compatibility endpoint; registration must use email confirmation
- `POST /api/auth/login` - email + password (Passport local)
- `POST /api/auth/refresh` - refresh token rotation
- `GET /api/auth/me` - Bearer JWT profile

Admin routes (`/api/admin/*`, ADMIN only):

- `GET /api/admin/users` - list/search users
- `GET /api/admin/users/:uuid` - full user profile with related entities
- `PATCH /api/admin/users/:uuid` - update allowed profile fields (email/password/telegram/deletion date are locked)
- `DELETE /api/admin/users/:uuid` - delete user (self-delete is blocked)
- `POST /api/admin/users/:uuid/email-change-request` - send secure email-change confirmation link to the new email
- `POST /api/admin/users/:uuid/reactivate-account` - unfreeze account pending deletion
- `GET /api/admin/categories` / `POST` / `PATCH /:id` / `DELETE /:id` - category CRUD
- `GET /api/admin/company-users` - list users with `COMPANY` role
- `GET /api/admin/company-users/:uuid` / `PATCH` / `DELETE` - company user CRUD
- `PUT /api/admin/company-users/:uuid/company-profile` - upsert company profile
- `GET /api/admin/company-users/:uuid/subscriptions` - company subscriptions
- `GET /api/admin/company-users/:uuid/clients` - company clients with search, pagination, sorting, points stats, and current level
- `POST /api/admin/company-users/:uuid/subscriptions` - create company-bound subscription
- `PATCH /api/admin/company-users/:uuid/subscriptions/:subscriptionUuid` - update company subscription
- `DELETE /api/admin/company-users/:uuid/subscriptions/:subscriptionUuid` - delete company subscription
- `GET /api/admin/subscriptions/stats` - subscription KPI/stats payload
- `GET /api/admin/subscriptions/:uuid` - subscription lookup by UUID
- `GET /api/admin/audit` - audit stream (`workspace=MANAGER|DEVELOPER`, filters by query/tag/page)
- `POST /api/admin/audit` - create manual audit event from admin UI
- `GET /api/admin/backups` - list DB snapshots
- `POST /api/admin/backups` - create DB snapshot (`CURRENT | SEED | MANUAL`)
- `GET /api/admin/backups/:backupId/file` - download snapshot payload
- `POST /api/admin/backups/:backupId/restore` - destructive restore (requires confirmation)
- `DELETE /api/admin/backups/:backupId` - delete snapshot
- `GET /api/admin/backups/restore-status` - live restore process status
- `GET /api/admin/dashboard` - live operational metrics and permission-filtered task queue
- `GET` / `POST /api/admin/tasks` - operations Kanban tasks and manual task creation
- `GET /api/admin/tasks/:uuid` / `PATCH` - view, take or resolve an admin task
- `GET /api/admin/system-health` - critical system incidents and source-linked alerts
- `GET /api/admin/payments` - YooKassa payment ledger
- `GET /api/admin/company-users/:uuid/overview` - company operational stats
- `GET /api/admin/company-users/:uuid/payments` - company payment ledger
- `GET /api/admin/company-users/:uuid/security` - company staff/security summary
- `POST /api/admin/company-users/:uuid/billing-extension` - extend company NearLoy access without payment and optionally notify owners in Telegram
- `GET` / `POST /api/admin/ai/assist` - permission-scoped admin AI assistant
- `POST /api/admin/ai/apply` - apply safe admin AI actions after explicit confirmation
- `GET` / `POST /api/admin/finance-operations` - finance payout queue with company/PR coverage snapshots
- `PATCH /api/admin/finance-operations/:uuid` - approve/reject payout, send/sync YooKassa test payout, or close manually

Company workspace routes (`/api/company/*`, COMPANY membership):

- `GET /api/company/profile` / `GET /api/company/dashboard` - partner identity and operating metrics
- `GET /api/company/clients` / `GET /api/company/clients/:uuid` - related customer search and QR-opened customer record
- `POST /api/company/loyalty/award` - manual points or purchase-based cashback award
- `GET` / `POST /api/company/team` - company staff and invitations
- `PATCH /api/company/team/:uuid/role` / `PATCH /api/company/team/:uuid/status` - local company roles and staff access
- `GET /api/company/finance` / `POST /api/company/finance/payouts` - revenue forecast and payout request
- `GET /api/company/billing` - NearLoy subscription, invoice, saved payment method and payment history
- `POST /api/company/billing/checkout` - create/reuse YooKassa checkout for NearLoy subscription
- `POST /api/company/billing/payment-method/pay` / `DELETE /api/company/billing/payment-method` - charge or remove saved YooKassa method
- `POST /api/company/ai/assist` - safe AI drafts for launch, offers, finance explanations and loyalty levels
- `GET` / `POST /api/company/subscriptions` - company tariff workspace
- `POST /api/company/subscriptions/:uuid/entitlements` - service usage limits
- `POST /api/company/subscriptions/redemptions` - controlled service redemption
- `GET /api/company/club` / `POST /api/company/club/bundles` - partner club and paired subscription proposals
- `POST /api/company/club/bundles/:uuid/approve|reject` - two-sided proposal workflow
- `POST /api/company/club/bundles/redemptions` - redeem only the current company benefit in a paired subscription
- `GET` / `POST /api/company/media` - list/upload public logo, hero and gallery assets
- `POST /api/company/media/offers` / `DELETE /api/company/media/offers/:id` - manage public special offers

Registered routes (`/api/registered/*`, CLIENT only):

- `GET /api/registered/dashboard` - client dashboard read model from DB
- `GET /api/registered/marketplace` - active subscription marketplace from DB
- `GET /api/registered/companies` - companies with user points and level progress
- `GET /api/registered/wallet` - wallet cards and total point balance
- `GET /api/registered/qr` - current-user QR payload
- `GET /api/registered/history` - loyalty history and archived subscriptions
- `GET /api/registered/subscriptions/active` - active subscriptions
- `GET /api/registered/subscriptions/archive` - expired/canceled subscriptions
- `POST /api/registered/payments/subscriptions/:uuid/checkout` - create YooKassa checkout for a subscription or bundle
- `GET /api/registered/payments/:uuid` - sync/check current user's payment status and activate after successful payment
- `PUT /api/registered/companies/:id/favorite` - favorite/unfavorite company
- `GET /api/public/company-media/:slug` - public company card media and offers

Payments:

- `POST /api/payments/yookassa/webhook` - YooKassa webhook; the API verifies the provider payment by status sync
- `GET /api/admin/payments` - admin payment ledger with status filters and provider identifiers
- `POST /api/company/billing/checkout` - create YooKassa checkout for company NearLoy billing
- `GET /api/company/billing/payments/:uuid` - sync/check company billing payment status
- `POST /api/company/billing/payment-method/pay` - pay with saved YooKassa method
- `DELETE /api/company/billing/payment-method` - remove saved YooKassa method metadata

Set `NEXT_PUBLIC_API_URL=http://localhost:3001/api` for the Next.js auth and admin API clients.
Set `NEXT_PUBLIC_YANDEX_MAPS_API_KEY=<key>` to enable the Yandex Maps JS API integration on `/map`.
Set `YANDEX_GEOCODER_API_KEY=<key>` to let admin company locations resolve addresses into saved coordinates.
Set `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_RETURN_URL` and `YOOKASSA_COMPANY_RETURN_URL` to enable YooKassa checkout payments.
Set `YOOKASSA_PAYOUT_AGENT_ID`, `YOOKASSA_PAYOUT_SECRET_KEY` and `YOOKASSA_PAYOUT_ALLOW_RAW_CARD=true` for the YooKassa test payout gateway in `/admin/finance`; manual payout closure remains available for launch.
Set `EMAIL_PROVIDER=resend` and `RESEND_API_KEY` for production email delivery on Railway; SMTP may time out on Railway Hobby.
Set `OPENAI_API_KEY` on the API service to enable `/company/ai`; default model is `gpt-5.4-nano` with compact JSON output and no critical-system actions.
Set `OPENAI_ADMIN_ASSISTANT_MODEL` and `OPENAI_ADMIN_ASSISTANT_MAX_OUTPUT_TOKENS` only when the admin assistant needs a different model/output cap than company AI.
For local development from networks where direct OpenAI access is unavailable, set `AI_GATEWAY_SECRET` on the deployed API service and use `OPENAI_GATEWAY_URL` + `OPENAI_GATEWAY_SECRET` locally. The browser still never receives the OpenAI key.
Set `DAILY_REPORT_SCHEDULER_ENABLED=true`, `DAILY_REPORT_TIME_MSK=23:00` and `DAILY_REPORT_SECRET` to run the Telegram daily report scheduler.

## Backup and Restore Safety

- During DB restore, API enters maintenance lock mode and blocks regular operations with `503`.
- Allowed during maintenance:
- `GET /api/health`
- `POST /api/admin/backups/:backupId/restore`
- `GET /api/admin/backups/restore-status`
- Restore uses transactional flow plus DB table lock to preserve consistency.
- Admin backup UI shows real-time restore stages and progress.

## Admin UI Overview

- `/admin` - live operations dashboard and prioritized task board
- `/admin/ai` - permission-scoped admin AI assistant
- `/admin/tasks` - operations Kanban board
- `/admin/tasks/:uuid` - task resolution workspace with a direct route to the source alert/workflow
- `/admin/users` - users directory
- `/admin/users/:uuid` - full user profile editor
- `/admin/categories` - categories CRUD
- `/admin/companies` - company users directory
- `/admin/companies/:uuid` - company profile + subscriptions CRUD
- `/admin/companies/:uuid/clients` - company clients table with search, sorting, pagination, and expandable details
- `/admin/companies/:uuid/payments` - company payments
- `/admin/companies/:uuid/security` - company staff/security summary
- `/admin/finance` - company/PR payout operations with YooKassa test payout and manual closure
- `/admin/payments` - provider payment ledger
- `/admin/system-health` - critical alerts cockpit
- `/admin/database` - interactive DB map (zoom, pan, relations)
- `/admin/subscriptions` - KPI/SLA dashboard + forecast analytics
- `/admin/audit` - manager/developer audit feed
- `/admin/audit/new` - manual audit event creation
- `/admin/audit/backups` - save/download/restore/delete DB snapshots
- `/company` - company operational dashboard
- `/company/clients` - cashier workspace for QR, customer points and subscription redemption
- `/company/subscriptions` - plans and usage rules
- `/company/club` - entrepreneur club and paired subscription workflow
- `/company/team` - owner/manager/cashier membership management
- `/company/payments` - subscription forecast and payout requests
- `/company/billing` - NearLoy subscription payment and saved YooKassa method
- `/company/settings/media` - logo, hero, gallery and public offers
- `/email-change/confirm?token=...` - public confirmation page for user email change
- `/loyalty-cards` - client list of companies where the user has earned points
- `/wallet/[slug]` - authenticated client card or public read-only company showcase

## Tests

Full local verification:

```bash
npm run ci:verify
```

API tests only:

```bash
npm run api:test
```

## Loyalty notes

- `Min redeem` (stored as `pointsPerReward`) defines the minimum points threshold from which a client can redeem points.
- Level validation prevents invalid cashback ladders: for higher spend thresholds, cashback must stay the same or increase.
- Client marketplace, partners, category, wallet, map, and history screens are backed by registered API read models instead of mock data.
- Company addresses are stored as `CompanyLocation` rows; admin company pages can geocode addresses and `/map` renders saved location coordinates.
- Partner/category filtering respects multi-category company relations.
- Company operations separate platform role `COMPANY` from membership roles `OWNER`, `MANAGER` and `CASHIER`.
- Subscription benefits can be period-limited or marked `UNLIMITED` for repeatable access such as gym entry while still recording each redemption.
- Subscription redemptions use configured service allowances and periodic windows; QR replay protection remains a required pre-production enhancement.
- `AdminTask` turns open verification requests, pending finance approvals and critical audit alerts into one deduplicated resolution queue. Task visibility follows granular admin permissions.
- Subscription activation is paid: the client creates a YooKassa checkout and activates the subscription only after `PaymentStatus.SUCCEEDED`.
- Pending YooKassa checkouts are reused during the 15-minute payment window to prevent duplicate orders.
- Company public media and offers are managed from `/company/settings/media`; production needs persistent storage or object storage before heavy real uploads.

## Build

```bash
npm run build
npm run api:build
```

## Deployment

For the investor demo / production preview, deploy to Railway as two Node services:

- `nearloy-api` - NestJS API
- `nearloy-web` - Next.js web app

See `docs/deployment-railway.md` for build commands, start commands, environment variables, and the post-deploy checklist.
See `docs/ci-cd.md` for GitHub Actions checks, production migrations, and required GitHub Secrets.

## Docs

See `docs/project-map/` for architecture, entities, routes, services, UI notes, and the admin database map.

Key docs:

- `docs/local-development.md`
- `docs/ci-cd.md`
- `docs/deployment-railway.md`
- `docs/project-map/project-map.md`
- `docs/project-map/project-architecture.md`
- `docs/project-map/project-entities.md`
- `docs/project-map/project-services.md`
- `docs/project-map/project-ui.md`
- `docs/project-map/database-map.md`
- `docs/project-map/recent-prs.md`
- `docs/company-workspace.md`

## Contribution Policy

- PR-only workflow to `main`.
- Direct pushes to `main` are not allowed by project policy.
- Merge to `main` is done manually by repository owner after review.
- Agents must not push without an explicit user command, and every pushed change must be surfaced through a Pull Request link for owner confirmation.

Details: see `CONTRIBUTING.md`.
