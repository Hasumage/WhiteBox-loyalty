# Nearloy Hunt Concept Notes

This file is the original working concept note. Dedicated game documentation now lives in `docs/hunt/`:

- `docs/hunt/README.md`
- `docs/hunt/product-concept.md`
- `docs/hunt/domain-model.md`
- `docs/hunt/api.md`
- `docs/hunt/content-data.md`
- `docs/hunt/economy-and-balancing.md`
- `docs/hunt/local-development.md`
- `docs/hunt/ui-guidelines.md`
- `docs/hunt/roadmap.md`

Working name: `Nearloy Hunt`, short forms `NH` and `НХ`.

## Core idea

Nearloy Hunt is a social city game inside Nearloy. Users play as local bloggers/scouts: they create GPS-bound posts about real places, receive Nearloy likes as social proof, earn in-game NearCoin currency, open boxes and collect unique character cards with rarity, traits and stats.

The product should not depend on companies being connected at launch. Places can be user-created or discovered first; companies can later claim a place, sponsor drops, publish offers or turn social demand into a Nearloy loyalty flow.

## Primary loop

1. User visits or selects a nearby place.
2. User creates a post with photo/text/tags and GPS/place context.
3. Other users react with Nearloy likes.
4. Likes generate in-game currency such as `NearCoin`, `Sparks`, `Hype` or `NH Coins`.
5. Currency opens boxes.
6. Boxes drop unique collectible character cards.
7. Cards have rarity, stats, traits, origin category and visual identity.
8. Cards can be upgraded through currency, repeat posting, missions, streaks and category expertise.

## Design stance

- Web2-first: call cards `digital collectibles` or `Hunt Cards`; keep NFT/minting optional and hidden until a later phase.
- GPS is context/proof for a post, not a hard dependency for every action.
- Nearloy likes are not raw money. They are social signals that create game currency under anti-spam rules.
- The game is about local reputation, discovery and content usefulness, not play-to-earn.
- Characters should feel born from user reputation and city activity, not randomly placed monsters on a map.

## Anti-spam and safety requirements

- Daily post limits and progressive trust levels.
- GPS proximity or place-context checks for rewarded posts.
- Unique-user like weighting.
- Reduced rewards for reciprocal like rings, duplicate photos/text and low-quality posts.
- Report, hide, shadow-ban and moderation queue flows.
- Clear UGC license in user terms: broad non-exclusive license for Nearloy to store, display, promote, adapt and reuse posts in Nearloy surfaces and marketing.
- Separate legal/privacy handling for photos, geolocation and personal data.
- Future paid promotion must support Russian internet ad labeling requirements.

## MVP

- `/hunt` feed and map entry.
- Create GPS/place-bound post with photo, text and tags.
- Nearloy-like reaction.
- NearCoin currency balance.
- Box opening.
- Hunt Card collection with rarity, stats and level.
- Daily missions.
- Shareable post/card preview for Telegram and Max.
- Basic reporting/moderation.

## Initial implementation

- Prisma models are in `prisma/schema.prisma`; migration: `prisma/migrations/20260828120000_nearloy_hunt/migration.sql`.
- Nest module: `apps/api/src/hunt/*`.
- Client API helpers: `src/lib/api/twa-client.ts`.
- Mobile UI: `src/app/(twa)/hunt/page.tsx`.
- Local sandbox DB helper: `npm run db:hunt:create`.
- Hunt seed: `npm run db:seed:hunt`.

## Visual direction

Nearloy Hunt should inherit Nearloy's dark mobile UI, glass surfaces, cyan glow and compass/star identity. The game layer may add controlled accent colors by rarity/category, but should stay sleek, urban and premium rather than childish fantasy.
