# NearLoy - Database Map

The admin database map lives at `/admin/database` and is implemented in `src/app/(portal)/admin/database/page.tsx`.

## Purpose

The page is a visual schema explorer for admins/developers. It is not a database editor. It helps inspect groups of Prisma models, hide noisy tables and understand relation paths before changing data or migrations.

## Synced Prisma models

The visual map should track all Prisma models. Current schema models:

- `User`
- `ProfileStatus`
- `UserProfileStatusUnlock`
- `PlatformCounter`
- `AdminUserPermission`
- `Category`
- `UserFavoriteCategory`
- `Company`
- `CompanyBillingAccount`
- `CompanyBillingInvoice`
- `CompanyBillingPromoCode`
- `CompanyBillingPromoRedemption`
- `Payment`
- `CompanyReferral`
- `CompanyVerificationApplication`
- `CompanyKycRecord`
- `CompanyKycAccessLog`
- `PassportVerificationFile`
- `FinanceOperation`
- `TelegramLinkToken`
- `CustomerLookupCode`
- `Subscription`
- `SubscriptionBundle`
- `SubscriptionBundleParticipant`
- `UserSubscriptionBundle`
- `CompanyLocation`
- `CompanyCategory`
- `CompanyMediaAsset`
- `CompanySpecialOffer`
- `CompanyLevelRule`
- `CompanyMember`
- `CompanyPurchase`
- `UserCompany`
- `UserSubscription`
- `SubscriptionEntitlement`
- `SubscriptionRedemption`
- `SubscriptionBundleRedemption`
- `UserProfilePreference`
- `PromoCode`
- `PromoCodeRedemption`
- `ReferralCampaign`
- `ReferralInvite`
- `RefreshToken`
- `OAuthAccount`
- `LoginEvent`
- `LoyaltyTransaction`
- `EmailChangeRequest`
- `EmailMessage`
- `EmailVerificationCode`
- `AuditEvent`
- `AdminTask`
- `LandingLead`
- `NotificationDelivery`
- `TelegramMessageQueue`

## UX features

- Mouse wheel zoom with page-scroll blocking while the cursor is over the schema viewport.
- Drag-to-pan canvas.
- Reset, zoom in and zoom out controls.
- Eye button per model to hide/show table and its relations.
- Grouped model chips with icons.
- Presets for focused views.

## Presets

- `Full Schema`: all models and relations.
- `Company, Locations + Subscriptions`: companies, branches, categories, subscriptions and user links.
- `Security & Access`: user/session/oauth/login/email/audit models.
- `Loyalty Structure`: categories, companies, balances, levels and loyalty transactions.
- `Growth: Promo + Referral`: promo, referral and reward ledger models.
- `Map + Branches`: company locations, categories and map-related context.
- `Billing + Payments`: YooKassa payments, company billing account/invoices/promos, finance operations and payout provider metadata.
- `Company Public Media`: company slug, logo/hero/gallery assets and special offers.
- `Operations`: admin tasks, system alerts, landing leads and notification queues.

## Maintenance rule

Whenever `prisma/schema.prisma` adds, removes or renames a model, update:

1. `nodes` in `src/app/(portal)/admin/database/page.tsx`.
2. `edges` in the same file.
3. `nodeMeta` group/icon mapping.
4. Relevant `presets`.
5. This document and `project-entities.md`.
