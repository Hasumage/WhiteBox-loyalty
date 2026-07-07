# NearLoy - Architecture Overview

## Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind, Framer Motion.
- Backend: NestJS, Passport local/JWT, Swagger, global guards.
- Data: Prisma 7, PostgreSQL, generated Prisma Client.
- Maps: Yandex Maps JavaScript API v3 with reactify; server-side Yandex Geocoder.
- Deployment: Railway API service, Railway Web service, Railway PostgreSQL.
- CI/CD: GitHub Actions PR verification and production migration gate.
- Messaging: Telegram Bot API for landing leads and admin verification notifications.
- Email: persisted `EmailMessage` ledger with Resend HTTP provider and SMTP fallback.
- Payments: YooKassa checkout, webhook/status sync, 15-minute pending window and saved company payment methods.
- Localization: lightweight RU/EN dictionary layer with cookie and DB-backed user preference.

## Main layers

1. UI layer: `src/app`, `src/components`.
2. API client layer: `src/lib/api/*`.
3. HTTP API layer: `apps/api/src/*`.
4. Persistence layer: Prisma schema, migrations and PostgreSQL.
5. Deployment layer: Railway scripts and GitHub Actions.

## Access model

- `CLIENT`: client app routes and `/api/registered/*`.
- `COMPANY`: company portal routes.
- `ADMIN`: legacy full admin access.
- `SUPER_ADMIN`: full access, including approvals and permission management.
- `MANAGER`: operational access with finance requests that require super-admin approval.
- `SUPPORT`: support-only access; no finance, passport review or privileged verification actions.
- Granular user permissions can further restrict view/edit access per admin account.

Authorization is layered:

- Next middleware handles UX redirects and role-aware route routing.
- Nest `JwtAuthMiddleware` verifies API JWT signatures and attaches `req.user`.
- `RolesGuard` enforces role access on controllers.
- `MaintenanceGuard` blocks normal API operations during DB restore.

## Core data flows

### Auth/session

1. User registers through the email-code flow or logs in through `/api/auth/*`.
2. API creates short-lived access token and rotating refresh token.
3. Frontend stores access token in localStorage and `wb_access_token` cookie.
4. Web middleware uses decoded token role/expiry for routing only.
5. API guards perform real signed-token verification.
6. Direct public `/auth/register` is blocked; unconfirmed accounts can request a new code and verify without conflicting with their own pending account.
7. Production email delivery must use a configured provider. In deployed environments the API fails loudly instead of marking unsent mail as dev-outbox success.

### Client marketplace and wallet

1. The client app calls `/api/registered/marketplace`, `/companies`, `/wallet`, `/history`.
2. `RegisteredService` builds UI-ready read models from Prisma.
3. Category filters are derived from active data, not hardcoded mock lists.
4. Activation creates an active `UserSubscription` and ensures company-user linkage.
5. `/wallet/[slug]` supports both authenticated client interaction and public read-only sharing.
6. Public cards can show company hero/logo/gallery/offers through `/api/public/company-media/[slug]`.

### YooKassa payment lifecycle

1. Checkout requests create or reuse a `Payment` in a provider-pending state.
2. A pending checkout remains reusable during the YooKassa payment window instead of creating duplicate orders.
3. Provider status can be synchronized from webhook, success page polling or explicit payment-status reads.
4. Successful payments activate the target client subscription, bundle or company billing invoice.
5. Pending payments older than the configured window are finalized as `EXPIRED` or unsuccessful.
6. Company saved payment methods store encrypted provider method identifiers and display-only card metadata; raw card data stays with YooKassa.

### Company points and levels

1. `UserCompany` stores company-specific balance.
2. `LoyaltyTransaction` stores earn/spend ledger events.
3. `CompanyLevelRule` defines spend thresholds and cashback percentages.
4. Client and admin analytics calculate current level from persisted company-specific activity.

### Locations and map

1. Admin saves company addresses in `/admin/companies/[uuid]`.
2. API resolves coordinates through Yandex Geocoder and stores `CompanyLocation`.
3. Registered API returns active locations to the client app.
4. `/map` renders category markers, clusters, selected-point cards, route presets and filters.

### Growth

1. Admin configures promo codes and referral campaign in `/admin/growth`.
2. Promo redemption records `PromoCodeRedemption` and grants either company points or subscription activation.
3. Referral redemption records `ReferralInvite` and rewards both users using current `ReferralCampaign` rules.

### Landing leads and Telegram

1. `/landing` contact form validates rate limits and spam heuristics.
2. Valid leads are stored as `LandingLead` rows with delivery history.
3. Telegram notifications are sent to active `ADMIN`, `SUPER_ADMIN` and `MANAGER` users with linked `User.telegramId`.
4. Admin can inspect, update status, retry failed sends and open the lead detail page.

### Company verification

1. `/company/register` creates a pending company-owner user request.
2. The user can request full identity verification or limited test access.
3. Passport photos are encrypted at rest in private local storage and referenced from DB metadata.
4. Admin review can approve/reject and then cleanup passport files and DB file references.
5. Verification requests notify the shared admin Telegram chat configured by `TELEGRAM_ADMIN_CHAT_ID`.

### Company ownership and staff assignment

1. Platform role `COMPANY` grants access to the company portal, while `CompanyMember` stores the local role inside a specific company.
2. Admins can create a company while changing a user to `COMPANY` or attach that user to an existing company.
3. Existing staff can be reassigned to another company when an account needs to move.
4. Removing the last company owner from the `COMPANY` role requires explicit ownership transfer or company deactivation/removal.

### Admin tasks and system health

1. Operational sources such as finance, company verification and audit signals synchronize into `AdminTask`.
2. `admin/tasks` is the canonical Kanban board for assignment, status changes, detail modal and archive.
3. `admin/system-health` focuses on critical incidents and source links instead of low-priority delivery queues.
4. Task and dashboard visibility is filtered by permission scope so counters do not leak sensitive queues.

### Company media showcase

1. `/company/settings/media` lets a company manage public logo, hero, gallery images and special offers.
2. Upload endpoints normalize storage metadata into `CompanyMediaAsset` and `CompanySpecialOffer`.
3. Public cards consume media by company slug.
4. Runtime storage is acceptable for demo/dev; production scale needs persistent volume or object storage.

### Localization

1. Middleware chooses a preferred locale from cookie, geo/headers and defaults.
2. Logged-in user language is persisted through `UserProfilePreference.preferredLocale`.
3. The admin shell owns the single language switcher.
4. Dictionaries are split by domain under `src/lib/i18n/dictionaries` to keep migration to a future framework mechanical.

### Backup restore safety

1. Admin starts restore from `/admin/audit/backups`.
2. `MaintenanceStateService` enters restore mode.
3. `MaintenanceGuard` returns `503 MAINTENANCE_RESTORE` for regular operations.
4. Restore validates payload, clears/restores tables and resets sequences.
5. UI polls restore status and unlocks after `DONE` or `FAILED`.

## Testing and quality gates

- `npm run ci:verify` runs Prisma generate/validate, ESLint, web build, API build and API Jest tests.
- GitHub Actions runs the same verification on PRs with temporary PostgreSQL.
- Production migrations run only after `main` verification succeeds.
