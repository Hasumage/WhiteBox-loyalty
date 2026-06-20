# NearLoy - Database Map

The admin database map lives at `/admin/database` and is implemented in `src/app/(portal)/admin/database/page.tsx`.

## Purpose

The page is a visual schema explorer for admins/developers. It is not a database editor. It helps inspect groups of Prisma models, hide noisy tables and understand relation paths before changing data or migrations.

## Synced Prisma models

The visual map currently includes all Prisma models:

- `User`
- `Category`
- `Company`
- `Subscription`
- `CompanyLocation`
- `UserProfilePreference`
- `UserFavoriteCategory`
- `CompanyCategory`
- `CompanyLevelRule`
- `UserCompany`
- `UserSubscription`
- `PromoCode`
- `PromoCodeRedemption`
- `ReferralCampaign`
- `ReferralInvite`
- `LoyaltyTransaction`
- `RefreshToken`
- `OAuthAccount`
- `LoginEvent`
- `EmailChangeRequest`
- `AuditEvent`

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

## Maintenance rule

Whenever `prisma/schema.prisma` adds, removes or renames a model, update:

1. `nodes` in `src/app/(portal)/admin/database/page.tsx`.
2. `edges` in the same file.
3. `nodeMeta` group/icon mapping.
4. Relevant `presets`.
5. This document and `project-entities.md`.
