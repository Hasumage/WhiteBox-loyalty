# NearLoy - Core Entities and Types

## Prisma models

Current source of truth: `prisma/schema.prisma`.

Identity and access:

- `User`
- `RefreshToken`
- `OAuthAccount`
- `OAuthState`
- `OAuthLoginTicket`
- `LoginEvent`
- `EmailChangeRequest`
- `EmailMessage`
- `EmailVerificationCode`
- `AuditEvent`
- `AdminTask`
- `AdminUserPermission`
- `TelegramLinkToken`
- `CustomerLookupCode`

Catalog and partners:

- `Category`
- `Company`
- `CompanyCategory`
- `CompanyLocation`
- `CompanyMediaAsset`
- `CompanySpecialOffer`
- `CompanySocialLink`
- `CompanyLevelRule`
- `CompanyMember`
- `CompanyPurchase`
- `CompanyBillingAccount`
- `CompanyBillingInvoice`
- `CompanyBillingPromoCode`
- `CompanyBillingPromoRedemption`
- `CompanyReferral`
- `PrFunnelCompany`
- `CompanyVerificationApplication`
- `CompanyKycRecord`
- `CompanyKycAccessLog`
- `PassportVerificationFile`
- `Subscription`
- `SubscriptionEntitlement`
- `SubscriptionRedemption`
- `SubscriptionBundle`
- `SubscriptionBundleParticipant`
- `UserSubscriptionBundle`
- `SubscriptionBundleRedemption`
- `Payment`
- `FinanceOperation`

Client state and ledger:

- `UserFavoriteCategory`
- `UserProfilePreference`
- `HuntPlayerProfile`
- `HuntPlace`
- `HuntPost`
- `HuntPostReaction`
- `HuntCurrencyLedger`
- `HuntCreatureSpecies`
- `HuntBox`
- `HuntCard`
- `HuntMission`
- `HuntMissionProgress`
- `UserCompany`
- `UserSubscription`
- `LoyaltyTransaction`

Growth:

- `PromoCode`
- `PromoCodeRedemption`
- `ReferralCampaign`
- `ReferralInvite`

Operations:

- `LandingLead`
- `NotificationDelivery`
- `TelegramMessageQueue`
- `PlatformCounter`

## Enum highlights

- `ProfileStatusRarity`: `RARE | EPIC | LEGENDARY`
- `UserRole`: `CLIENT | COMPANY | ADMIN | SUPER_ADMIN | MANAGER | SUPPORT`
- `AccountStatus`: `ACTIVE | FROZEN_PENDING_DELETION | BLOCKED`
- `CompanyMemberRole`: `OWNER | MANAGER | CASHIER`
- `CompanyMediaKind`: `LOGO | HERO | GALLERY`
- `SubscriptionEntitlementWindow`: `DAY | WEEK | MONTH | TERM | UNLIMITED`
- `SubscriptionStatus`: `ACTIVE | EXPIRED | CANCELED`
- `LoyaltyTransactionType`: `EARN | SPEND`
- `LoyaltyTransactionStatus`: `ACTIVE | EXPIRED`
- `SubscriptionSpendPolicy`: `EXCLUDE | INCLUDE_NO_BONUS | INCLUDE_WITH_BONUS`
- `PaymentProvider`: `YOOKASSA`
- `PaymentPurpose`: `USER_SUBSCRIPTION | USER_SUBSCRIPTION_BUNDLE | COMPANY_NEARLOY_SUBSCRIPTION`
- `PaymentStatus`: `PENDING | WAITING_FOR_CAPTURE | SUCCEEDED | CANCELED | FAILED | REFUNDED | EXPIRED`
- `AuditWorkspace`: `MANAGER | DEVELOPER`
- `AuditLevel`: `INFO | WARN | CRITICAL`
- `AuditCategory`: `SECURITY | USER | SUBSCRIPTION | BILLING | SYSTEM`
- `AuditResult`: `SUCCESS | BLOCKED`
- `AdminTaskSource`: `AUDIT | COMPANY_VERIFICATION | FINANCE`
- `AdminTaskPriority`: `NORMAL | HIGH | CRITICAL`
- `AdminTaskStatus`: `OPEN | IN_PROGRESS | RESOLVED | DISMISSED`
- `LandingLeadStatus`: `NEW | IN_PROGRESS | CLOSED | SPAM`
- `NotificationDeliveryStatus`: `PENDING | SENT | FAILED`
- `PermissionScope`: `USERS | COMPANIES | COMPANY_VERIFICATIONS | PR | FINANCE | SUPPORT | AUDIT | DATABASE | TELEGRAM | PROMOTION | SETTINGS`
- `FinanceOperationType`: `PAYOUT_REQUEST | PAYOUT_APPROVAL | MANUAL_ADJUSTMENT | REFUND`
- `FinanceOperationStatus`: `DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | PAID | CANCELED`
- `CompanyBillingStatus`: `TRIAL | ACTIVE | PAST_DUE | SUSPENDED`
- `CompanyBillingInvoiceStatus`: `OPEN | PAID | WAIVED | CANCELED`
- `CompanyVerificationStatus`: `DRAFT | SUBMITTED | REVIEWING | APPROVED | REJECTED`
- `CompanyEmploymentType`: `SELF_EMPLOYED | INDIVIDUAL_ENTREPRENEUR`
- `IdentityVerificationMode`: `FULL | DEFERRED`
- `PassportFileStatus`: `ACTIVE | DELETED | MISSING`
- `CompanyKycAccessAction`: `UPSERT_FROM_VERIFICATION | REVEAL_DATA | VIEW_PHOTO | DELETE_PHOTO`
- `CompanyReferralStatus`: `ACTIVE | PAUSED | ENDED`
- `CompanyReferralPipelineStatus`: `LEAD | NEGOTIATION | TRIAL | CONNECTED | REVENUE_ACTIVE | LOST`
- `SubscriptionBundleStatus`: `DRAFT | ACTIVE | ARCHIVED`
- `SubscriptionBundleParticipantStatus`: `PENDING | APPROVED | REJECTED`
- `PromoCodeRewardType`: `POINTS | SUBSCRIPTION`
- `ReferralInviteStatus`: `CREATED | REDEEMED | REWARDED`
- `EmailMessageStatus`: `PENDING | SENT | FAILED`
- `EmailMessageTargetType`: `USER | COMPANY | DIRECT`
- `EmailVerificationPurpose`: `REGISTRATION | PASSWORD_RESET`
- `EmailVerificationStatus`: `PENDING | CONSUMED | EXPIRED`
- `CompanySocialLinkKind`: `WEBSITE | VK | MAX | OTHER`
- `HuntPlaceSource`: `USER_SUGGESTED | COMPANY | SYSTEM_SEEDED`
- `HuntPostStatus`: `PUBLISHED | HIDDEN | REMOVED`
- `HuntModerationStatus`: `CLEAR | FLAGGED | REVIEWING | ACTIONED`
- `HuntReactionType`: `LIKE`
- `HuntCurrencyReason`: `POST_CREATED | POST_LIKED | POST_TRENDING | BOX_OPENED | MISSION_REWARD | CARD_UPGRADE | MODERATION_REVERSAL | ADMIN_ADJUSTMENT`
- `HuntBoxStatus`: `GRANTED | OPENED | EXPIRED`
- `HuntBoxType`: `DAILY | POST | TRENDING | CATEGORY | DISTRICT | FOUNDER | PARTNER`
- `HuntCardRarity`: `COMMON | UNCOMMON | RARE | EPIC | LEGENDARY`
- `HuntElement`: `FLAME | WATER | NATURE | WIND | MUSIC | LIGHT | SHADOW`
- `HuntMissionKind`: `DAILY | WEEKLY | SEASONAL | ONBOARDING`

## Relationship map

- `User 1:N RefreshToken`, `OAuthAccount`, `OAuthLoginTicket`, `LoginEvent`, `LoyaltyTransaction`, `PromoCodeRedemption`.
- `User 1:1 UserProfilePreference`.
- `User N:M Category` through `UserFavoriteCategory`.
- `User N:M Company` through `UserCompany`.
- `UserCompany` also stores company-specific points and favorite state (`isFavorite`, `favoritedAt`).
- `User N:M Subscription` through `UserSubscription`.
- `User 1:1 Company` through `Company.ownerUserId`.
- `User N:M Company` as staff through `CompanyMember`.
- `User 1:N ReferralInvite` as inviter; `User 1:1 ReferralInvite` as invited user.
- `User 1:N AuditEvent` as actor and as target.
- `User 1:N AdminTask` as assignee and as resolver.
- `User 1:N EmailMessage` as sender/target.
- `User 1:1 HuntPlayerProfile`; `User 1:N HuntPost`, `HuntPostReaction`, `HuntCurrencyLedger`, `HuntBox`, `HuntCard` and `HuntMissionProgress`.
- `Category 1:N Company` as primary category.
- `Company N:M Category` through `CompanyCategory`.
- `Company 1:N CompanyLocation`, `CompanyLevelRule`, `Subscription`, `LoyaltyTransaction`.
- `Company 1:N CompanyMember`, `CompanyPurchase`, `SubscriptionRedemption`.
- `Company 1:1 CompanyBillingAccount`; `Company 1:N CompanyBillingInvoice`, `Payment`, `CompanyMediaAsset`, `CompanySpecialOffer`, `CompanySocialLink`.
- `Company 1:1 CompanyReferral`; referral owner is a `User`.
- `Company 1:N PrFunnelCompany` as attributed/acquisition funnel records.
- `Company 1:N HuntPlace` and `HuntPost` when a game place/post is later connected to a real company.
- `Category 1:N HuntPlace`, `HuntPost` and `HuntCreatureSpecies`.
- `Company 1:1 CompanyKycRecord`; KYC access/deletion is audited through `CompanyKycAccessLog`.
- `Subscription 1:N SubscriptionEntitlement`.
- `UserSubscription 1:N SubscriptionRedemption`.
- `SubscriptionBundle N:M Company` through `SubscriptionBundleParticipant`; user purchases go through `UserSubscriptionBundle`.
- `Company 1:N PromoCode` for points rewards.
- `Company 1:N ReferralCampaign` for referral bonus company.
- `Subscription 1:N PromoCode` for activation promos.
- `PromoCode 1:N PromoCodeRedemption`.
- `Payment` can target user subscriptions, user subscription bundles or company NearLoy billing invoices depending on `PaymentPurpose`.
- `FinanceOperation` tracks company/PR payout requests, approvals and closures. Provider payout fields store YooKassa payout id/status, idempotence key, destination type/label, provider payload and provider request/sync timestamps.
- `EmailVerificationCode` is reused for registration and password-reset codes through `EmailVerificationPurpose`.

## Company-specific points

Points are not universal. They belong to a company:

- `UserCompany.balance` is the current company balance.
- `LoyaltyTransaction.companyId` records the company for every earn/spend event.
- Promo/referral point rewards must resolve to a company and then update the same ledger/balance system.
- Favorite companies are not a separate table: the favorite flag lives on the same `UserCompany` link that stores the company-scoped balance.

## Company billing and payments

Company NearLoy billing is represented by:

- `CompanyBillingAccount` for the current access state, period and optional saved payment method metadata.
- `CompanyBillingInvoice` for monthly platform invoices and payment state.
- `CompanyBillingPromoCode` / `CompanyBillingPromoRedemption` for platform-fee discounts.
- `Payment` with `PaymentPurpose.COMPANY_NEARLOY_SUBSCRIPTION` for YooKassa provider transactions.

Provider card data is never stored in NearLoy. Saved company payment methods store encrypted YooKassa method identifiers plus display metadata such as card brand/last4.

## Finance operations and payouts

`FinanceOperation` is the operational payout ledger:

- Company payouts must be covered by the company's available payout balance.
- PR-agent payouts must be covered by earned unpaid referral commission.
- YooKassa payout metadata is optional and currently intended for test-gateway validation.
- Manual closure remains a first-class path for launch: admins can record method/reference/comment after an external transfer.
- Provider status changes notify the shared admin chat but are not treated as critical system-fire tasks by default.

## Public company media

Company public cards use:

- `Company.slug` as the stable public URL key.
- `CompanyMediaAsset` for logo, hero and gallery images.
- `CompanySpecialOffer` for public offers/promos shown on the company card.
- `CompanySocialLink` for public website/VK/Max/other links.

The current runtime storage layer is suitable for demo/dev. Production media should move to persistent Railway volume or object storage before heavy use.

## Telegram admin notifications

Operational Telegram delivery is routed to one shared admin chat:

- `TELEGRAM_ADMIN_CHAT_ID` stores the readable admin chat id. The app normalizes supergroup ids to the Bot API form (`-100...`) before sending.
- Landing leads, company verification requests and payout requests are sent to the shared admin chat instead of personal admin accounts.
- `User.telegramId` still stores linked private Telegram chats for personal flows such as account notifications, phone confirmation and client app entry.

## External account links

- `OAuthAccount` stores linked OAuth providers such as VK ID.
- `OAuthState` protects browser OAuth handoffs with hashed state and PKCE verifier data.
- `OAuthLoginTicket` stores short-lived one-time tickets that exchange OAuth callback success into a normal NearLoy session.
- `User.telegramId` and `User.maxId` store messenger-specific identities for Telegram and Max Mini App login/linking.

## Nearloy Hunt

- `HuntPlayerProfile` stores player-level progress and cached counters.
- `HuntPlace` stores user-suggested, company-backed or seeded places. It can exist before a company joins Nearloy.
- `HuntPost` stores GPS/place-bound user content with moderation status, tags, score and cached like count.
- `HuntPostReaction` enforces one Nearloy-like per user/post/type.
- `HuntCurrencyLedger` is the source of truth for Influence changes and balance-after auditability.
- `HuntCreatureSpecies` defines collectible creature families, base stats, traits and visual prompt hints.
- `HuntBox` stores granted/opened boxes and their source post/reward card relationship.
- `HuntCard` stores the actual user's collectible card, rolled rarity, element, stats, trait and visual seed.
- `HuntMission` and `HuntMissionProgress` support onboarding, daily, weekly and seasonal tasks.

## Location model

`CompanyLocation` stores real branches:

- `address`, `city`, coordinates and geocoder precision/metadata.
- `openTime`, `closeTime`, `workingDays` for open-now filtering.
- `isMain` for primary branch display.
- `isActive` for hiding branches from the client map and partner cards.

Duplicate addresses are rejected server-side per company after normalization/geocoder resolution.

## Backup payload

DB backup schema version `2` serializes operational tables including company memberships, purchases, subscription entitlements, redemptions, finance operations and admin tasks. Restore is destructive and protected by maintenance mode.

## Admin work queue

`AdminTask` is a deduplicated operational work item, not one copy per administrator:

- `sourceKey` uniquely connects a task to its origin, for example `audit:<id>` or `verification:<uuid>`.
- Open company verifications and pending finance operations synchronize into tasks and close when the linked workflow is completed.
- Critical audit signals, including Telegram delivery fire alerts, create an actionable task leading to the source context.
- Task visibility is filtered by the administrator's matching permission scope: audit, company verification or finance.
