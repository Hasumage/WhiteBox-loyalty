# Recent merged PRs

This document summarizes the last five merged PRs that define the current NearLoy product state.

## PR #21 — Hotfix production email delivery handling

- Production email delivery no longer falls back to silent dev-outbox success.
- Email sending supports Resend HTTP delivery first and SMTP fallback when configured.
- SMTP delivery has explicit connection, greeting, socket and DNS timeouts plus IPv4 tuning.
- Railway deployment docs now call out that Railway Hobby outbound SMTP is unreliable and production must use a reachable provider, preferably HTTP over 443.

## PR #20 — Public company card, media showcase and account ownership updates

- Registration is email-code-first: direct `/auth/register` is blocked and unconfirmed accounts can request/verify a new code without false `Email is already registered`.
- Admin user management can attach a user to an existing company, create a company while changing role to `COMPANY`, or reassign a company staff member.
- Changing a company owner away from `COMPANY` is guarded: ownership must move to another active staff member or the company is deactivated/removed when no staff remains.
- `/wallet/[slug]` now supports public company cards for unauthenticated visitors with gallery, offers, levels and NearLoy CTA, while interactive actions remain for authenticated clients.
- Company media management was added under `/company/settings/media`: logo, hero, gallery up to 10 photos and special offers.
- Company favorites are stored on `UserCompany.isFavorite` / `favoritedAt` without a separate favorites table.

## PR #19 — Company billing, admin operations and system alerts release

- API CORS accepts `nearloy.ru`, `www.nearloy.ru`, Railway web domain and localhost through configurable frontend origins.
- YooKassa is the active payment provider for client subscriptions and company NearLoy billing.
- Payment confirmation is universal: success pages and webhooks both sync provider status, so payment can be applied even if the user does not return from YooKassa.
- Pending YooKassa payments are reused during the 15-minute payment window instead of creating duplicate orders.
- Expired pending payments are finalized as unsuccessful/expired.
- Company billing supports saved YooKassa payment method identifiers for companies; card data stays on YooKassa side and only encrypted method metadata is stored.
- Admin got `admin/payments`, company payment subpage, company security subpage, PR/referral subpage, operational company stats and compact company catalog UI.
- `admin/tasks` became the operational Kanban board with columns, filters, assignment, archive and modal detail workflow.
- `admin/system-health` now focuses on critical system alerts and task-linked incidents rather than treating the Telegram queue as the main health signal.
- Profile statuses got larger sorted icon sets and a compact catalog suitable for many statuses.

## PR #18 — Company billing payments, daily reports and docs

- Company NearLoy billing checkout/status flow was added through YooKassa.
- `PaymentPurpose.COMPANY_NEARLOY_SUBSCRIPTION` and related schema/migration support company billing invoices.
- Company billing UI shows YooKassa payment, balance payment, promo code, commission credit and payment history in one place.
- Daily admin report endpoint and report helpers/tests were added.
- Docs were corrected from old placeholder payment wording to the YooKassa-backed flow.
- Repository workflow rules were documented: no git push without direct user command, publication only through PR and owner confirmation by PR link.

## PR #17 — Company workspace and admin operations foundation

- Company workspace matured into a real partner portal: dashboard, clients/cashier, team, subscriptions, club, finance, compliance and getting-started surfaces.
- Company staff roles are separated from platform roles through `CompanyMember`.
- Subscription entitlements, redemptions, bundled subscriptions, referral payout reservations and minimum subscription price rules were introduced or hardened.
- Admin and company logout/session flows, map picker, local polling safety, profile statuses and release-ready NearLoy surfaces were shipped.
- CI/CD, backup coverage and local development docs were updated around the new operational models.

## Documentation impact

The project docs should now describe NearLoy as:

- A paid YooKassa-backed loyalty/subscription platform, not a placeholder payment demo.
- A multi-surface product: client app, public company card, company partner portal, admin operations cockpit and public onboarding.
- A company-media aware product with public galleries/offers and runtime storage limits.
- An operations platform with task Kanban, system health and permission-scoped alerts.
- An email-delivery product that requires production-safe provider configuration.
