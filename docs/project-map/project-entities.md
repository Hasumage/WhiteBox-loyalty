# NearLoy - Core Entities and Types

## Prisma models

Current source of truth: `prisma/schema.prisma`.

Identity and access:

- `User`
- `RefreshToken`
- `OAuthAccount`
- `LoginEvent`
- `EmailChangeRequest`
- `AuditEvent`
- `AdminTask`

Catalog and partners:

- `Category`
- `Company`
- `CompanyCategory`
- `CompanyLocation`
- `CompanyLevelRule`
- `CompanyMember`
- `CompanyPurchase`
- `Subscription`
- `SubscriptionEntitlement`
- `SubscriptionRedemption`

Client state and ledger:

- `UserFavoriteCategory`
- `UserProfilePreference`
- `UserCompany`
- `UserSubscription`
- `LoyaltyTransaction`

Growth:

- `PromoCode`
- `PromoCodeRedemption`
- `ReferralCampaign`
- `ReferralInvite`

## Enum highlights

- `UserRole`: `CLIENT | COMPANY | ADMIN | SUPER_ADMIN | MANAGER | SUPPORT`
- `AccountStatus`: `ACTIVE | FROZEN_PENDING_DELETION | BLOCKED`
- `CompanyMemberRole`: `OWNER | MANAGER | CASHIER`
- `SubscriptionEntitlementWindow`: `DAY | WEEK | MONTH | TERM | UNLIMITED`
- `SubscriptionStatus`: `ACTIVE | EXPIRED | CANCELED`
- `LoyaltyTransactionType`: `EARN | SPEND`
- `LoyaltyTransactionStatus`: `ACTIVE | EXPIRED`
- `SubscriptionSpendPolicy`: `EXCLUDE | INCLUDE_NO_BONUS | INCLUDE_WITH_BONUS`
- `AuditWorkspace`: `MANAGER | DEVELOPER`
- `AuditLevel`: `INFO | WARN | CRITICAL`
- `AuditCategory`: `SECURITY | USER | SUBSCRIPTION | BILLING | SYSTEM`
- `AuditResult`: `SUCCESS | BLOCKED`
- `AdminTaskSource`: `AUDIT | COMPANY_VERIFICATION | FINANCE`
- `AdminTaskPriority`: `NORMAL | HIGH | CRITICAL`
- `AdminTaskStatus`: `OPEN | IN_PROGRESS | RESOLVED | DISMISSED`
- `PromoCodeRewardType`: `POINTS | SUBSCRIPTION`
- `ReferralInviteStatus`: `CREATED | REDEEMED | REWARDED`

## Relationship map

- `User 1:N RefreshToken`, `OAuthAccount`, `LoginEvent`, `LoyaltyTransaction`, `PromoCodeRedemption`.
- `User 1:1 UserProfilePreference`.
- `User N:M Category` through `UserFavoriteCategory`.
- `User N:M Company` through `UserCompany`.
- `User N:M Subscription` through `UserSubscription`.
- `User 1:1 Company` through `Company.ownerUserId`.
- `User 1:N ReferralInvite` as inviter; `User 1:1 ReferralInvite` as invited user.
- `User 1:N AuditEvent` as actor and as target.
- `User 1:N AdminTask` as assignee and as resolver.
- `Category 1:N Company` as primary category.
- `Company N:M Category` through `CompanyCategory`.
- `Company 1:N CompanyLocation`, `CompanyLevelRule`, `Subscription`, `LoyaltyTransaction`.
- `Company 1:N CompanyMember`, `CompanyPurchase`, `SubscriptionRedemption`.
- `Subscription 1:N SubscriptionEntitlement`.
- `UserSubscription 1:N SubscriptionRedemption`.
- `Company 1:N PromoCode` for points rewards.
- `Company 1:N ReferralCampaign` for referral bonus company.
- `Subscription 1:N PromoCode` for activation promos.
- `PromoCode 1:N PromoCodeRedemption`.

## Company-specific points

Points are not universal. They belong to a company:

- `UserCompany.balance` is the current company balance.
- `LoyaltyTransaction.companyId` records the company for every earn/spend event.
- Promo/referral point rewards must resolve to a company and then update the same ledger/balance system.

## Telegram admin notifications

Operational Telegram delivery is routed to one shared admin chat:

- `TELEGRAM_ADMIN_CHAT_ID` stores the readable admin chat id. The app normalizes supergroup ids to the Bot API form (`-100...`) before sending.
- Landing leads, company verification requests and payout requests are sent to the shared admin chat instead of personal admin accounts.
- `User.telegramId` still stores linked private Telegram chats for personal flows such as account notifications, phone confirmation and mini app entry.

## Location model

`CompanyLocation` stores real branches:

- `address`, `city`, coordinates and geocoder precision/metadata.
- `openTime`, `closeTime`, `workingDays` for open-now filtering.
- `isMain` for primary branch display.
- `isActive` for hiding branches from the TWA map and partner cards.

Duplicate addresses are rejected server-side per company after normalization/geocoder resolution.

## Backup payload

DB backup schema version `2` serializes operational tables including company memberships, purchases, subscription entitlements, redemptions, finance operations and admin tasks. Restore is destructive and protected by maintenance mode.

## Admin work queue

`AdminTask` is a deduplicated operational work item, not one copy per administrator:

- `sourceKey` uniquely connects a task to its origin, for example `audit:<id>` or `verification:<uuid>`.
- Open company verifications and pending finance operations synchronize into tasks and close when the linked workflow is completed.
- Critical audit signals, including Telegram delivery fire alerts, create an actionable task leading to the source context.
- Task visibility is filtered by the administrator's matching permission scope: audit, company verification or finance.
