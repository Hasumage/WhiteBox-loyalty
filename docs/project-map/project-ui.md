# NearLoy - UI Components and Routes

## Route structure

| Path | Purpose | Access |
|---|---|---|
| `/` | Client dashboard | CLIENT |
| `/login` | Login | Public |
| `/register` | Registration | Public |
| `/forgot-password` | Password reset by email code | Public |
| `/email-change/confirm` | Email change confirmation | Public |
| `/onboarding` | First-run tutorial with skip | CLIENT |
| `/companies` | All partners | CLIENT |
| `/loyalty-cards` | Companies where the user has points/activity | CLIENT |
| `/marketplace` | Subscription catalog | CLIENT |
| `/marketplace/[id]` | Subscription detail | CLIENT |
| `/wallet/[slug]` | Company loyalty card detail and public read-only showcase | CLIENT/Public |
| `/map` | Yandex partner map | CLIENT |
| `/history` | Activity and subscription archive | CLIENT |
| `/scan` | User QR | CLIENT |
| `/settings` | Profile, stats, favorites, promo/referral | CLIENT |
| `/settings/account` | Privacy/account actions | CLIENT |
| `/settings/favorites` | Favorite categories | CLIENT |
| `/settings/business`, `/settings/partnership`, `/settings/reviews` | Profile subpages/placeholders | CLIENT |
| `/help/*` | FAQ/contact/privacy | Public |
| `/landing` | Marketing landing and Telegram-backed lead form | Public |
| `/business` | Business marketing landing with company CTA and giveaway entry | Public |
| `/business/giveaway` | 100 000 RUB business giveaway page with active-company progress vessel | Public |
| `/business/giveaway/rules` | Dedicated giveaway participation rules | Public |
| `/careers` | Localized careers hub with role cards and SEO job metadata | Public |
| `/careers/[slug]` | Generic vacancy detail page | Public |
| `/careers/b2b-manager` | Detailed B2B acquisition manager vacancy | Public |
| `/company/register` | Company onboarding and verification request | Public |
| `/company` | Company operational dashboard | COMPANY member |
| `/company/clients` | Cashier QR, points and subscription redemption workspace | COMPANY member |
| `/company/ai` | Company AI assistant for launch, offers, finance explanations and loyalty drafts | COMPANY member |
| `/company/subscriptions` | Plans and entitlement rules | COMPANY member |
| `/company/club` | Entrepreneur club, partner discovery and paired subscription proposals | COMPANY member |
| `/company/team` | Local owner/manager/cashier administration | COMPANY owner/manager |
| `/company/payments` | Forecast and payout requests | COMPANY owner/manager |
| `/company/billing` | NearLoy subscription payment, YooKassa status and saved payment method | COMPANY owner/manager |
| `/company/compliance` | Partner profile and verification status | COMPANY member |
| `/company/settings` | Company profile/settings hub | COMPANY owner/manager |
| `/company/settings/locations` | Company addresses and map data | COMPANY owner/manager |
| `/company/settings/media` | Public logo, hero, gallery and special offers | COMPANY owner/manager |
| `/admin` | Live operations dashboard and priority task queue | ADMIN/MANAGER by permission |
| `/admin/ai` | Permission-scoped admin AI assistant with safe confirmed actions | ADMIN/MANAGER by permission |
| `/admin/tasks` | Full operations Kanban with filters, assignment and archive | ADMIN/MANAGER by source permission |
| `/admin/tasks/[uuid]` | Task resolution workspace and source handoff | ADMIN/MANAGER by source permission |
| `/admin/users`, `/admin/users/[uuid]` | User operations | ADMIN |
| `/admin/users/[uuid]/permissions` | Granular user permissions | SUPER_ADMIN |
| `/admin/categories` | Category CRUD | ADMIN |
| `/admin/companies`, `/admin/companies/[uuid]` | Company accounts/profile/locations/subscriptions | ADMIN |
| `/admin/companies/[uuid]/clients` | Company client analytics | ADMIN |
| `/admin/companies/[uuid]/payments` | Company payment history and billing ledger | ADMIN |
| `/admin/companies/[uuid]/security` | Company staff/security overview | ADMIN |
| `/admin/companies/[uuid]/referral` | Company PR/referral attribution | ADMIN |
| `/admin/company-verifications`, `/admin/company-verifications/[uuid]` | Verified company intake review | ADMIN/MANAGER |
| `/admin/leads`, `/admin/leads/[uuid]` | Landing lead inbox and Telegram delivery history | ADMIN/MANAGER |
| `/admin/telegram` | Admin Telegram direct-message link | ADMIN |
| `/admin/finance` | Finance operations, payout coverage, YooKassa test payouts and manual closure | MANAGER/SUPER_ADMIN |
| `/admin/support` | Support-only workspace | SUPPORT |
| `/admin/subscriptions` | Subscription analytics | ADMIN |
| `/admin/growth` | Promo/referral management | ADMIN |
| `/admin/database` | Prisma schema visualizer | ADMIN |
| `/admin/audit`, `/admin/audit/new`, `/admin/audit/backups` | Audit and backups | ADMIN |
| `/admin/payments` | YooKassa payment ledger, statuses and provider identifiers | ADMIN |
| `/admin/system-health` | Critical system alerts and incident source cockpit | ADMIN |
| `/admin/company-billing-promos` | Company billing promo code management | SUPER_ADMIN/Admin finance access |
| `/admin/compliance` | Future compliance module | ADMIN |

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
- Public marketing pages reuse the same RU/EN locale state. Careers content is stored as typed localized role data under `src/app/careers/careerRoles.ts` instead of hard-coded single-language pages.

## Client UX state

- QR element is only on `/scan`; it was removed from global/profile surfaces.
- Bottom nav labels use `Profile` instead of old `Settings` naming where applicable.
- Favorite categories can be selected in onboarding/settings and are capped at 10 in UI/API validation.
- Marketplace and partner filters use compact quick chips and extended filter panels.
- Partner filters respect multi-category companies and hide empty categories where appropriate.
- Client API reads use a short-lived TTL cache for dashboard, marketplace, partners, history, map and profile data. Pages hydrate from the cached snapshot first, then refresh from API when needed, so users do not see zero balances or empty cards during navigation.
- First-load states use `TwaLoadingScreen` skeletons instead of raw empty/fallback values.
- `TwaStaleDataNudge` appears after 10 minutes on one client route and gently suggests a refresh.
- Company cards support slug sharing. Authenticated users can favorite/share/route; unauthenticated visitors see a read-only public card with levels, gallery, offers and NearLoy CTA.
- The route button hides when a company has no active address and should handle multiple addresses as a route-selection case.
- The big favorite CTA animates into the header heart; removing favorite does not resurrect the big CTA until reload.

## Public marketing UX

- `MarketingHeader` keeps the normal desktop navigation visible on wide screens and switches to a full-screen mobile overlay on phones.
- The mobile marketing menu overlays the page instead of pushing layout, and contains navigation links, language switcher, login and partner CTA inside the menu.
- `/business` links companies into registration and into the 100 000 RUB giveaway flow.
- `/business/giveaway` visualizes progress toward 50 active companies with a liquid-vessel meter and vertical scenario cards using lightweight themed images.
- `/business/giveaway/rules` is the authoritative public rule page for the giveaway. It is reachable from the giveaway flow, not from the global footer.
- `/careers` is a public SEO surface for NearLoy jobs; role cards link to individual detail pages and the hero intentionally avoids heavy CTA buttons.
- `/careers/b2b-manager` is the detailed launch-role page for B2B acquisition, including conditions, expectations and a Telegram CTA to the project lead.
- `MarketingFooter` is shared by marketing pages and keeps the footer light: careers plus user/company terms links only.
- Root metadata uses `NEXT_PUBLIC_SITE_URL` with a production fallback so public SEO URLs remain absolute.
- Unknown routes render the branded 404 page with mascot artwork and standard recovery actions.

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
- `/admin/tasks` is the primary view: a compact full-width Kanban, not a help/overview screen.
- Task cards stay compact; detailed descriptions, reassignment and archive actions live in the modal/detail view.
- `/admin/system-health` shows critical alerts and sources first. Telegram queue is secondary diagnostics, not the main health object.
- Company catalog mirrors user-table visual style: filters/chips, search on Enter, hidden UUID column while UUID search still works, long names truncated safely.
- `/admin/ai` is a full-height chat surface, not a quick-command panel. It uses plain-language prompts, optional image paste/upload and permission-scoped context.
- Admin AI output should read like an operational assistant: concise greeting, concrete findings, tables for finance/PR debt when useful, and explicit confirmation before supported safe actions.
- `/admin/finance` stays dense: the operator sees the queue immediately, selects a payout, then uses the side inspector for checklist, payout/company details, YooKassa test payout or manual close. Long company/payout names are truncated with full values in tooltips.
- Finance scrollbars are styled to the dark UI; raw browser-white scrollbars should not appear in the payout workspace.

## Company UX

- The company portal follows the admin console visual language while keeping permissions isolated from NearLoy staff roles.
- Cashiers land on customer operations: QR open, scoped search, fixed point award, purchase cashback and entitlement redemption.
- Owners and managers maintain plans, usage limits, staff access and payout requests.
- Finance cards explicitly distinguish monthly forecast from funds approved for payout.
- Billing uses the word "subscription", not "subscription fee"/"abonent fee" wording. The page explains active/past-due state, pending payment links, status checks and saved YooKassa method controls.
- Company AI is a draft-only helper. UI keeps prompts short, shows compact JSON-backed results and reminds users that AI cannot change passwords, access, roles, payouts, payment methods or infrastructure.
- Media settings define fixed standards: logo `512x512`, hero `960x420`, gallery `900x675`, offer image `900x506`. UI should crop/preview/delete before upload.
- NearLoy does not store card data. Saved payment method UI must say that YooKassa stores the method and NearLoy stores only an encrypted identifier.

## Key components

- `NearLoyLogo` - portal brand.
- `MarketingHeader` - public landing navigation, desktop nav and mobile overlay menu.
- `MarketingFooter` - shared public footer for landing, business, giveaway and careers pages.
- `BottomNav` - client app nav.
- `CategoryIcon` - shared category icon renderer.
- `CategoryChipStrip` - horizontal category chips.
- `select-field`, `category-select`, `category-multi-select` - styled form controls.
- `FrozenAccountDialog`, `DeleteAccountDialog`, `ChangePasswordDialog` - account state UX.
- Company card hero/public media components consume `CompanyMediaAsset` and public fallback demo assets.
- Task modal/dialog components own long descriptions, assignment and archive actions.

## Manual smoke checklist

- Register client -> onboarding appears -> skip works.
- Login admin/company/client seed accounts.
- Admin creates/edits company location and sees coordinates saved.
- Client map shows branch marker and route button.
- Activate marketplace subscription -> dashboard active subscriptions updates.
- Earn points for company -> `/loyalty-cards` and `/wallet/[slug]` update.
- Open `/wallet/[slug]` signed out -> public card shows gallery/offers/levels and no interactive app-only actions.
- Upload company logo/hero/gallery/offer -> public card media updates and old assets can be deleted.
- Company billing checkout -> pending payment is reused for 15 minutes and status sync activates billing after provider success.
- Admin tasks -> create manual task, assign user, move to work/archive and verify dashboard counters.
- Create points promo -> redeem in the client app -> loyalty transaction appears.
- Create subscription promo -> redeem in the client app -> active subscription appears.
- Referral code redeem rewards both sides and blocks self/duplicate redemption.
- Create backup -> download -> restore status UI updates.
