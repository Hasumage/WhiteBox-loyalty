# WhiteBox - UI Components and Routes

## Route structure

| Path | Purpose | Access |
|---|---|---|
| `/` | TWA dashboard | CLIENT |
| `/login` | Login | Public |
| `/register` | Registration | Public |
| `/email-change/confirm` | Email change confirmation | Public |
| `/onboarding` | First-run tutorial with skip | CLIENT |
| `/companies` | All partners | CLIENT |
| `/loyalty-cards` | Companies where the user has points/activity | CLIENT |
| `/marketplace` | Subscription catalog | CLIENT |
| `/marketplace/[id]` | Subscription detail | CLIENT |
| `/wallet/[id]` | Company loyalty card detail | CLIENT |
| `/map` | Yandex partner map | CLIENT |
| `/history` | Activity and subscription archive | CLIENT |
| `/scan` | User QR | CLIENT |
| `/settings` | Profile, stats, favorites, promo/referral | CLIENT |
| `/settings/account` | Privacy/account actions | CLIENT |
| `/settings/favorites` | Favorite categories | CLIENT |
| `/settings/business`, `/settings/partnership`, `/settings/reviews` | Profile subpages/placeholders | CLIENT |
| `/help/*` | FAQ/contact/privacy | Public |
| `/landing` | Marketing landing and Telegram-backed lead form | Public |
| `/company/register` | Company onboarding and verification request | Public |
| `/company` | Company operational dashboard | COMPANY member |
| `/company/clients` | Cashier QR, points and subscription redemption workspace | COMPANY member |
| `/company/subscriptions` | Plans and entitlement rules | COMPANY member |
| `/company/team` | Local owner/manager/cashier administration | COMPANY owner/manager |
| `/company/payments` | Forecast and payout requests | COMPANY owner/manager |
| `/company/compliance` | Partner profile and verification status | COMPANY member |
| `/admin` | Live operations dashboard and priority task queue | ADMIN/MANAGER by permission |
| `/admin/tasks/[uuid]` | Task resolution workspace and source handoff | ADMIN/MANAGER by source permission |
| `/admin/users`, `/admin/users/[uuid]` | User operations | ADMIN |
| `/admin/users/[uuid]/permissions` | Granular user permissions | SUPER_ADMIN |
| `/admin/categories` | Category CRUD | ADMIN |
| `/admin/companies`, `/admin/companies/[uuid]` | Company accounts/profile/locations/subscriptions | ADMIN |
| `/admin/companies/[uuid]/clients` | Company client analytics | ADMIN |
| `/admin/company-verifications`, `/admin/company-verifications/[uuid]` | Verified company intake review | ADMIN/MANAGER |
| `/admin/leads`, `/admin/leads/[uuid]` | Landing lead inbox and Telegram delivery history | ADMIN/MANAGER |
| `/admin/telegram` | Admin Telegram direct-message link | ADMIN |
| `/admin/finance` | Finance operations and approval workflow | MANAGER/SUPER_ADMIN |
| `/admin/support` | Support-only workspace | SUPPORT |
| `/admin/subscriptions` | Subscription analytics | ADMIN |
| `/admin/growth` | Promo/referral management | ADMIN |
| `/admin/database` | Prisma schema visualizer | ADMIN |
| `/admin/audit`, `/admin/audit/new`, `/admin/audit/backups` | Audit and backups | ADMIN |
| `/admin/payments`, `/admin/compliance` | Future modules | ADMIN |

## Layout hierarchy

- `src/app/layout.tsx`: root shell, dark theme and typography.
- `src/app/(auth)/layout.tsx`: centered auth pages.
- `src/app/(twa)/layout.tsx`: mobile viewport, transitions and bottom nav.
- `src/app/(portal)/layout.tsx`: desktop portal sidebar and content grid.

## Localization

- Admin navigation owns the single RU/EN language switcher.
- Page copy is stored in structured dictionaries under `src/lib/i18n/dictionaries`.
- Locale is persisted in the `wb_locale` cookie and, for authorized users, in `UserProfilePreference.preferredLocale`.
- New admin pages should not add local language toggles. Add keys to the relevant dictionary namespace and consume them through `useI18n`.

## TWA UX state

- QR element is only on `/scan`; it was removed from global/profile surfaces.
- Bottom nav labels use `Profile` instead of old `Settings` naming where applicable.
- Favorite categories can be selected in onboarding/settings and are capped at 10 in UI/API validation.
- Marketplace and partner filters use compact quick chips and extended filter panels.
- Partner filters respect multi-category companies and hide empty categories where appropriate.
- TWA API reads use a short-lived client TTL cache for dashboard, marketplace, partners, history, map and profile data. Pages hydrate from the cached snapshot first, then refresh from API when needed, so users do not see zero balances or empty cards during navigation.
- First-load states use `TwaLoadingScreen` skeletons instead of raw empty/fallback values.
- `TwaStaleDataNudge` appears after 10 minutes on one TWA route and gently suggests a refresh.

## Map UX

- Yandex Maps JS API v3 is used on `/map`.
- Browser geolocation is optional and shows a user marker when allowed.
- Search matches company name, address and category and shows results under the input without chaotic camera jumps.
- Filters include all/main branches, open-now and active-subscription partners.
- Markers use category icons and cluster at low zoom.
- Clicking a cluster shows up to 10 addresses below the map.
- Selected-point card shows open/closed state, categories, hours, distance, user points, route presets, open-card action and nearby branches.
- Route presets open Yandex routes for car, walk and public transit.

## Admin UX

- Admin pages are desktop-first.
- Company pages use collapsible sections with quick-jump controls.
- Locations section supports multiple addresses, geocoding, main/active flags, hours and duplicate prevention.
- Subscriptions admin has KPI/SLA cards, 30/90-day forecast and visual analytics.
- Growth admin supports promo search/sort/edit/pause/activate and referral campaign settings.
- Database map has grouped chips, icons, presets, hide/show eye buttons, pan and wheel zoom.
- Backups UI supports snapshot creation, download, restore confirmation, deletion and live restore statuses.
- Mobile admin uses a compact top bar, bottom primary navigation and drawer-based full navigation while preserving the desktop sidebar.
- Admin menu badges show unresolved company verification counters with `20+` cap.
- Telegram page shows linked state and reconnect flow instead of asking for a link when already connected.
- Dashboard figures are DB-backed; its priority queue combines system alerts, company verification requests and finance approvals without duplicated cards.
- Each task opens a focused resolution screen. Alert tasks can be closed there, while workflow tasks close from their authoritative verification or finance decision.
- Dashboard and sidebar task counts respect granular permissions, so sensitive queues are not exposed as counters.

## Company UX

- The company portal follows the admin console visual language while keeping permissions isolated from WhiteBox staff roles.
- Cashiers land on customer operations: QR open, scoped search, fixed point award, purchase cashback and entitlement redemption.
- Owners and managers maintain plans, usage limits, staff access and payout requests.
- Finance cards explicitly distinguish monthly forecast from funds approved for payout.

## Key components

- `WhiteBoxLogo` - portal brand.
- `BottomNav` - TWA nav.
- `CategoryIcon` - shared category icon renderer.
- `CategoryChipStrip` - horizontal category chips.
- `select-field`, `category-select`, `category-multi-select` - styled form controls.
- `FrozenAccountDialog`, `DeleteAccountDialog`, `ChangePasswordDialog` - account state UX.

## Manual smoke checklist

- Register client -> onboarding appears -> skip works.
- Login admin/company/client seed accounts.
- Admin creates/edits company location and sees coordinates saved.
- TWA map shows branch marker and route button.
- Activate marketplace subscription -> dashboard active subscriptions updates.
- Earn points for company -> `/loyalty-cards` and `/wallet/[id]` update.
- Create points promo -> redeem in TWA -> loyalty transaction appears.
- Create subscription promo -> redeem in TWA -> active subscription appears.
- Referral code redeem rewards both sides and blocks self/duplicate redemption.
- Create backup -> download -> restore status UI updates.
