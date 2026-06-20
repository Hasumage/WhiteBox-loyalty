# NearLoy - Services and Data Access

## Data strategy

NearLoy now uses PostgreSQL-backed read models for the TWA. Mock data is legacy/static fallback only.

Important principles:

- Marketplace, partners, wallet, map, history, profile, onboarding, promo codes and referral flows are API-driven.
- Points are company-scoped and stored in `UserCompany` + `LoyaltyTransaction`.
- Company branches are stored in `CompanyLocation` with geocoded coordinates and working hours.
- Subscription payment providers are stubbed for now; activation is a non-payment flow.
- Production migrations are applied by GitHub Actions after `main` verification succeeds.

## Frontend API clients

- `src/lib/api/auth-client.ts` - login/register/session/account actions.
- `src/lib/api/categories-client.ts` - categories and favorite categories.
- `src/lib/api/admin-client.ts` - admin users, companies, categories, subscriptions, growth, audit and backups.
- `src/lib/api/company-client.ts` - company dashboard, cashier, team, plans, entitlements, redemptions and payouts.
- `src/lib/api/twa-client.ts` - TWA profile, dashboard, marketplace, companies, wallet, map/history/subscriptions, QR, promo/referral.
- `src/lib/i18n/*` - locale detection, persistence and portable dictionaries.
- `src/lib/telegram/*` - Telegram Bot API delivery, proxy support, webhook parsing and admin account linking.
- `src/lib/admin/admin-tasks.ts` - signal-to-task routing, source deduplication and automatic workflow task closure.

## Admin API surface

All `/api/admin/*` routes require `ADMIN`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/admin/profile` | GET | Current admin payload |
| `/api/admin/accounts` | POST | Create account with selected role |
| `/api/admin/users` | GET | Search/paginate/sort users |
| `/api/admin/users/:uuid` | GET | Full user profile and related entities |
| `/api/admin/users/:uuid` | PATCH | Update safe user fields |
| `/api/admin/users/:uuid` | DELETE | Delete user, self-delete blocked |
| `/api/admin/users/:uuid/role` | PATCH | Legacy role update endpoint |
| `/api/admin/users/:uuid/email-change-request` | POST | Create secure email-change token/link |
| `/api/admin/users/:uuid/force-logout` | POST | Revoke active refresh sessions |
| `/api/admin/users/:uuid/reactivate-account` | POST | Clear frozen deletion status |
| `/api/admin/dashboard` | GET | Live operating metrics and permission-filtered priority queue |
| `/api/admin/tasks/:uuid` | GET/PATCH | Read/take/resolve a work item and route to its source |
| `/api/admin/system-health` | GET/POST | System incident cockpit; open/resolve task-linked alerts |
| `/api/admin/subscriptions/stats` | GET | KPI/SLA/forecast stats payload |
| `/api/admin/subscriptions/:uuid` | GET | Subscription lookup by UUID |
| `/api/admin/promo-codes` | GET | Promo inventory with redemption counts |
| `/api/admin/promo-codes` | POST | Create points/subscription promo |
| `/api/admin/promo-codes/:id` | PATCH | Edit/pause/activate promo |
| `/api/admin/referral-campaign` | GET | Referral rules and stats |
| `/api/admin/referral-campaign` | PATCH | Update referral title, points and company |
| `/api/admin/categories` | GET/POST | List/create categories |
| `/api/admin/categories/:id` | PATCH/DELETE | Update/delete category |
| `/api/admin/company-users` | GET | List company-role users |
| `/api/admin/company-users/:uuid` | GET/PATCH/DELETE | Company account operations |
| `/api/admin/company-users/:uuid/company-profile` | PUT | Upsert company profile |
| `/api/admin/company-users/:uuid/locations` | POST | Create geocoded company address |
| `/api/admin/company-users/:uuid/locations/:locationUuid` | PATCH/DELETE | Update/delete company address |
| `/api/admin/company-users/:uuid/subscriptions` | GET/POST | List/create company subscriptions |
| `/api/admin/company-users/:uuid/subscriptions/:subscriptionUuid` | PATCH/DELETE | Update/delete company subscription |
| `/api/admin/company-users/:uuid/clients` | GET | Company clients, loyalty stats and levels |
| `/api/admin/audit` | GET/POST | Audit feed and manual audit events |
| `/api/admin/backups` | GET/POST | List/create DB snapshots |
| `/api/admin/backups/:backupId/file` | GET | Download snapshot JSON |
| `/api/admin/backups/:backupId/restore` | POST | Restore snapshot with confirmation |
| `/api/admin/backups/:backupId` | DELETE | Delete snapshot |
| `/api/admin/backups/restore-status` | GET | Live restore state |
| `/api/admin/company-verifications` | GET | Search/paginate company verification requests |
| `/api/admin/company-verifications/:uuid` | GET/PATCH | Review and update a verification request |
| `/api/admin/company-verifications/:uuid/approve` | POST | Approve verified company access |
| `/api/admin/company-verifications/:uuid/reject` | POST | Reject request and cleanup verification files |
| `/api/admin/company-verifications/passport-storage/sync` | POST | Reconcile encrypted passport files with DB records |
| `/api/admin/leads` | GET | Search/paginate landing leads |
| `/api/admin/leads/:uuid` | GET/PATCH | Lead detail and processing notes |
| `/api/admin/leads/retry-due` | POST | Retry due Telegram lead deliveries |
| `/api/admin/telegram/status` | GET | Current admin Telegram link status |
| `/api/admin/telegram-link-token` | POST | Create one-time Telegram deep-link token |
| `/api/admin/menu-notifications` | GET | Navigation notification counters |
| `/api/admin/finance/*` | GET/POST | Finance operation drafts and approval flow |
| `/api/admin/users/:uuid/permissions` | GET/PUT | Granular admin permission settings |

## Company API surface

All `/api/company/*` routes require an active company membership. Platform role and local company role are deliberately separate.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/company/profile` | GET | Company member and verified partner profile |
| `/api/company/dashboard` | GET | Customer, subscription, purchase and payout metrics |
| `/api/company/clients` | GET | Search existing customers scoped to this company |
| `/api/company/clients/:uuid` | GET | Customer operation card opened from QR |
| `/api/company/loyalty/award` | POST | Award manual points or cashback from a purchase |
| `/api/company/team` | GET/POST | List staff or invite a member |
| `/api/company/team/:uuid/role` | PATCH | Update a local membership role |
| `/api/company/team/:uuid/status` | PATCH | Enable/disable staff access |
| `/api/company/finance` | GET | Monthly-normalized subscription forecast and operation history |
| `/api/company/finance/payouts` | POST | Create payout request for approval |
| `/api/company/subscriptions` | GET/POST | Read or create company tariff plans |
| `/api/company/subscriptions/:uuid/entitlements` | POST | Configure controlled service issuance |
| `/api/company/subscriptions/redemptions` | POST | Consume an entitlement under its allowance |
| `/api/company/club` | GET | Partner club overview, verified companies and paired subscription proposals |
| `/api/company/club/bundles` | POST | Create a two-sided paired subscription proposal |
| `/api/company/club/bundles/:uuid/approve` | POST | Approve own company participation and activate when all sides approved |
| `/api/company/club/bundles/:uuid/reject` | POST | Reject and archive a paired subscription proposal |
| `/api/company/club/bundles/redemptions` | POST | Redeem only the current company participant benefit |

## Registered API surface

All `/api/registered/*` routes require `CLIENT`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/registered/profile` | GET | Client profile, stats, preferences and referral state |
| `/api/registered/onboarding/complete` | POST | Mark first-run tutorial completed |
| `/api/registered/onboarding/skip` | POST | Skip tutorial |
| `/api/registered/profile/preferences` | PUT | Update privacy/communication preferences |
| `/api/registered/referral` | GET | Referral code and campaign terms |
| `/api/registered/referral/redeem` | POST | Redeem friend referral code |
| `/api/registered/promo/redeem` | POST | Redeem promo code |
| `/api/registered/categories` | GET | Categories with favorite flags |
| `/api/registered/favorite-categories` | GET/PUT | Read/replace favorite category slugs |
| `/api/registered/dashboard` | GET | Home dashboard read model |
| `/api/registered/marketplace` | GET | Active subscription catalog; optional category filter |
| `/api/registered/companies` | GET | Partner list with points, levels and locations |
| `/api/registered/wallet` | GET | Loyalty cards where user has activity |
| `/api/registered/qr` | GET | UUID-based QR payload |
| `/api/registered/history` | GET | Points activity and subscription archive |
| `/api/registered/subscriptions/active` | GET | Active subscriptions |
| `/api/registered/subscriptions/archive` | GET | Expired/canceled subscriptions |
| `/api/registered/subscriptions/:uuid/activate` | POST | Activate subscription in payment-stub flow |

## Backend responsibilities

- `AuthService`: registration, login, refresh, password change, freeze/reactivate, login events and email confirmation.
- `AdminService`: users, companies, categories, locations, subscriptions, growth, audit, backups and analytics.
- `RegisteredService`: DB-backed TWA read models, profile preferences, favorites, promo/referral redemption, QR and subscription activation.
- `CompanyService`: local staff roles, cashier operations, tier cashback, entitlements/redemptions, revenue forecast and payout requests.
- `MaintenanceStateService`: restore progress state machine.
- `MaintenanceGuard`: API lock during restore.
- Landing lead services: contact intake, duplicate/spam checks, Telegram delivery history and retries.
- Company onboarding services: user-first company registration, identity verification modes, encrypted passport file lifecycle and admin review.
- Telegram services: Bot API proxy support, direct-message admin linking and webhook command handling.
- Admin task services: translate audit fires, verification reviews and finance approvals into deduplicated, permission-scoped resolution cards.
- i18n services: locale cookie, user preference persistence and structured translation dictionaries.

## Security and privacy responsibilities

- Passwords remain write-only and are never exposed through admin UI.
- Email changes use secure request links rather than direct admin edits.
- Passport photos are stored encrypted in private local storage, then removed after approve/reject cleanup.
- Support users are restricted away from finance, passport review and privileged verification actions.
- Critical admin actions write audit records where applicable.
- Customer text search in the company workspace is restricted to customers already related to that company; QR may open a new customer without disclosing email.
- Purchase cashback and limited entitlement redemption use serializable transactions to prevent double issuance and tier races; `UNLIMITED` entitlements record visits without enforcing a usage cap.
- Admin tasks never expand an operator's access: each task is visible and actionable only when its source permission permits the same operation.

## Map/geocoder responsibilities

- Admin calls location endpoints with human-readable address.
- API resolves address through Yandex Geocoder and stores coordinates/precision metadata.
- API rejects duplicate addresses for the same company.
- TWA `/map` renders active locations with custom category markers and zoom-aware clustering.
- Route links are generated client-side for Yandex Maps; geolocation is included when user allowed it.

## CI/CD responsibilities

- PRs run full verification against temporary PostgreSQL.
- Merge to `main` runs the same verification and production `prisma migrate deploy` using GitHub Secrets.
- Railway deploys web/API from `main` using service-aware root scripts.
