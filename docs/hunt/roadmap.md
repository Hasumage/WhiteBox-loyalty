# Nearloy Hunt Roadmap

## Phase 1: Local Foundation

Implemented:

- Prisma schema and migration.
- UGC/economy/moderation migration for media URLs, review fields, GPS confidence and reports.
- Separate local sandbox DB helper.
- Seeded species, missions and places.
- Nest Hunt module.
- Server-side local media upload/read endpoints.
- `/hunt` feed-first mobile page plus `/hunt/create`, `/hunt/shop`, `/hunt/cards` and `/hunt/all-cards` subpages.
- Three-step post composer with place, media and story stages.
- Photo upload, post/review fields, report button, share actions and card upgrade action.
- Public read-only share pages for posts and cards.
- Admin growth report endpoint for places with organic demand.
- `/admin/growth` Hunt demand block with priority/warm/watch/claimed filters.
- `/admin/hunt` moderation UI for reported posts, photos, places, reporters and hide/remove/clear actions.
- Tutorial, posts, likes, NearCoin, daily reward caps, shop boxes, card collection basics and upgrades.
- Client report flow and admin moderation endpoints.
- Generated creature card artwork split into per-element assets for the collection, card reveal and share surfaces.
- Public Terms, Company Terms and Privacy Policy updated for Hunt UGC, geolocation, moderation, game rewards and promotional content reuse.

## Phase 2: Product Hardening

Next:

- Production object storage for Hunt media.
- Cursor pagination for feed.
- Richer place search and deduplication.
- Stronger GPS confidence scoring with proximity checks.
- Better mission progress calculations.
- Dedicated card detail/collection screens.
- Deeper Hunt lead drill-down with recent posts, suggested outreach copy and claim readiness reasons.

## Phase 3: Growth Mechanics

Add:

- Local leaderboards by city/district/category.
- Weekly city events.
- Streaks and seasonal collections.
- Friend/referral missions.
- Telegram and Max share cards.
- Company claim flow from active places.
- Sponsored boxes only after moderation/ad-labeling rules are ready.

## Phase 4: Company Bridge

When companies begin joining:

- Let companies claim active `HuntPlace` records.
- Show demand proof: posts, likes, repeat visitors, category rank.
- Offer sponsored missions and drops.
- Connect company loyalty rewards to NH milestones.
- Add company dashboard widgets for NH activity.

## Phase 5: Optional NFT Layer

NFTs should not be part of MVP onboarding.

Only consider minting after the web2 game works:

- User owns a meaningful collection.
- Legal and tax implications are reviewed.
- Marketplace/scam risks are understood.
- Minting is opt-in.
- Non-crypto users can continue playing normally.

Cards should remain useful as Nearloy collectibles even without blockchain.

## Legal And Compliance Checklist

Before public launch:

- Update Terms with broad non-exclusive UGC license.
- Update Privacy Policy for location and media processing.
- Add content rules for posts/photos.
- Add report/takedown flow.
- Add moderation tooling.
- Add ad labeling flow for sponsored content in Russia before paid/sponsored Hunt placements.
- Add child/teen safety review if the product is marketed broadly.
