# Nearloy Hunt Docs

Nearloy Hunt is the game branch of Nearloy. It is a social city game where users create GPS/place-bound posts, receive Nearloy likes, earn `NearCoin`, open boxes and collect cute stylized Hunt Cards.

Working names:

- `Nearloy Hunt`
- `NH`
- `НХ`

## Current Status

The first local foundation is implemented:

- Separate local sandbox database flow through `npm run db:hunt:create`.
- Prisma schema, migration and seed data for Hunt profiles, places, posts, reactions, currency ledger, boxes, cards, species and missions.
- Nest API module at `apps/api/src/hunt/*`.
- Server-side Hunt media upload/read flow backed by local storage.
- Client API helpers in `src/lib/api/twa-client.ts`.
- Mobile game surface at `/hunt`.
- Admin database visualizer includes the Hunt schema group.

## Docs

- [Product Concept](./product-concept.md) - game thesis, loop, launch positioning and non-goals.
- [Domain Model](./domain-model.md) - entities, enums, relationships and scaling notes.
- [API](./api.md) - current Nest endpoints and server-authoritative rules.
- [Content Data](./content-data.md) - posts, reviews, place intelligence and moderation inputs.
- [Economy And Balancing](./economy-and-balancing.md) - NearCoin, rewards, boxes, rarity and anti-farm constraints.
- [Battle System](./battle-system.md) - detailed Russian design document for combat, matchmaking, rewards, API and server rules.
- [Local Development](./local-development.md) - local DB, migrations, seeds, dev servers and smoke checks.
- [UI Guidelines](./ui-guidelines.md) - how NH should feel inside Nearloy.
- [Roadmap](./roadmap.md) - next product, backend, moderation, legal and NFT phases.

## Important Files

- `prisma/schema.prisma`
- `prisma/migrations/20260828120000_nearloy_hunt/migration.sql`
- `prisma/seed-hunt.mjs`
- `scripts/create-hunt-db.mjs`
- `apps/api/src/hunt/*`
- `src/app/(twa)/hunt/page.tsx`
- `src/lib/api/twa-client.ts`
- `src/components/BottomNav.tsx`
- `src/middleware.ts`
- `src/app/(portal)/admin/database/page.tsx`
- `HUNT_MEDIA_DIR` or `apps/api/storage/hunt-media/` for local uploaded Hunt media during development.

## Local URLs

When local dev servers are running:

- Web: `http://localhost:3000/hunt`
- API: `http://localhost:3001/api/hunt/overview`
- Swagger: `http://localhost:3001/api/docs`
