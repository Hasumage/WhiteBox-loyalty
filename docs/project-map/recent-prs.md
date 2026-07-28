# Recent merged PRs

This document summarizes the recent product PRs and the current pending update that define the current NearLoy product state.

## Current update — Admin AI, finance payouts, auth recovery and operations polish

- Admin AI assistant was added under `/admin/ai` with permission-scoped context modules for overview, companies, users, finance, payments, PR, tasks, audit, Telegram and verification.
- Admin AI uses OpenAI when configured, can attach/paste images, keeps chat context client-side for the current page session, and may only propose/apply safe actions allowed by the admin's own permissions.
- Admin AI can prepare safe follow-up actions such as creating admin tasks or extending company NearLoy access; it must not bypass passwords, roles, payouts, provider secrets or permission gates.
- Company AI was hardened with a protected gateway path for local environments where direct OpenAI access is blocked; API keys remain server-side only.
- `/admin/finance` was rebuilt into a compact payout cockpit: action queue, selected-operation inspector, company/PR balance coverage, YooKassa test payout, manual payout closure, checklist, translated template reasons and styled scrollbars.
- Finance operations now store provider payout metadata, destination labels, provider timestamps and status, with a Prisma migration and finance payout seed data for manual testing.
- YooKassa payouts are available as a test-gateway path, while manual closure stays available for the self-employed launch model.
- Company pages gained manual NearLoy subscription extension by admins with month/day duration support and optional Telegram notifications for company owners.
- Authentication recovery now retries refresh-token login from protected pages and shows a friendly overlay instead of dumping users into a raw unauthorized state.
- Public marketing was expanded: `/business` now promotes the business-growth giveaway, `/business/giveaway` tracks progress toward 50 active companies with a liquid-vessel visual, and `/business/giveaway/rules` holds the dedicated participation rules.
- Giveaway content now explains the 100 000 RUB business-development prize without exposing billing mechanics in public copy, and uses vertical lightweight use-case cards with themed images.
- Careers were added under `/careers`, `/careers/[slug]` and `/careers/b2b-manager` with RU/EN copy, canonical metadata, OpenGraph/Twitter previews and JSON-LD `JobPosting` data.
- The detailed B2B acquisition manager vacancy is a standalone public page with the launch-stage conditions, long-term revenue model and a Telegram contact CTA for the project lead.
- Marketing pages share `MarketingFooter`; it keeps only the lightweight careers link plus user/company terms, while giveaway rules stay inside the giveaway flow.
- Landing header was rearranged around login-first CTAs, a desktop layout that stays visible on wide screens, and a full-screen mobile menu with navigation, language switcher and auth/partner actions inside the overlay.
- Root SEO metadata now uses `NEXT_PUBLIC_SITE_URL` with a `https://nearloy.ru` fallback so canonical, OpenGraph and JSON-LD URLs stay production-safe.
- A branded 404 surface was added with the NearLoy mascot artwork and standard recovery actions.
- Daily Telegram reports gained a scheduler script and Railway/local wiring so the 23:00 Moscow report can run outside manual endpoint calls.
- Production email/runtime docs now describe Resend, SMTP fallback, AI gateway configuration and Railway-specific environment expectations.

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
- A public marketing surface with business landing, giveaway, careers, legal terms and reusable header/footer components.
