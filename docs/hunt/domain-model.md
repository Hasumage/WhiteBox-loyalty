# Nearloy Hunt Domain Model

## Tactical Training State

The v7 training aggregate is a signed transient `Battle` in `src/lib/hunt/tactics.ts`, not a Prisma entity. `Fighter` holds position, normalized species profile, snapshotted ability definitions/revisions, HP, shield expiry, active effects and cooldowns. `Battle.statistics` tracks actual damage/healing/absorption/control by unit. `Battle.energy` is spendable resonance; `Battle.score` is non-spendable control score. Effects support damage, lifesteal, heal, shield, burn, poison, buffs, push and pull. Directional low cover remains separate from sight-blocking walls. [Rules and scaling](./tactical-arena.md).

Persistent definitions use `HuntAbility` (localized metadata, JSON config, schema/revision), `HuntSpeciesAbility` (unique ordered slots 0..2) and `HuntAbilityRevision` (immutable snapshots and actor). They extend `HuntCreatureSpecies` without rewriting owned cards. Administration and battle loading enforce three slots per species. [Storage, constraints and extension policy](./ability-framework.md).

## Aggregate Overview

The Hunt schema is attached to the existing Nearloy user/company/category graph, but the economy is modeled separately.

Core aggregates:

- `HuntPlayerProfile` - one game profile per Nearloy user.
- `HuntPlace` - a real or user-created place that can optionally link to a company.
- `HuntPost` - the main game action: a GPS/place-bound Nearloy post.
- `HuntPostReaction` - Nearloy-like or other reaction signal.
- `HuntPostReport` - one user report against a post for moderation.
- `HuntCurrencyLedger` - append-only NearCoin accounting.
- `HuntBox` - server-granted box that can be opened once.
- `HuntCreatureSpecies` - seeded creature/card template with its own visual identity and `baseStats` predisposition values from `1` to `10`.
- `HuntCard` - user-owned collectible instance with permanent rolled stats. Multiple cards may point to the same `HuntCreatureSpecies`; duplicates are expected box drops and keep their own `uuid`, stats, level and upgrade history.
- `HuntMission` - reusable mission definition.
- `HuntMissionProgress` - per-profile mission state.

## Key Relationships

- `User` has one optional `HuntPlayerProfile`.
- `User` can create Hunt places, posts, reactions and own cards/boxes through the profile.
- `Category` can classify Hunt places, posts, species and missions.
- `Company` can be linked to a `HuntPlace` after a real partner joins or claims the place.
- `HuntPost` belongs to one profile and one place.
- `HuntPostReaction` is unique per post/profile/reaction type.
- `HuntPostReport` is unique per post/reporter.
- `HuntCard` may reference the `HuntBox` it came from. Collection UIs should aggregate by species only for display, not as the storage model.
- `HuntMissionProgress` is unique per mission/profile.

## Important Enums

- `HuntPlaceSource`: where the place came from.
- `HuntPostStatus`: draft/published/hidden/deleted lifecycle.
- `HuntModerationStatus`: pending/approved/rejected/etc.
- `HuntReportReason`: spam/offensive/false-place/duplicate/private-data/copyright/other reasons.
- `HuntReportStatus`: open/reviewing/resolved/dismissed report lifecycle.
- `HuntReactionType`: currently centered on Nearloy likes.
- `HuntCurrencyReason`: why NearCoin changed.
- `HuntBoxStatus`: granted/opened/expired.
- `HuntBoxType`: onboarding/daily/event/etc.
- `HuntCardRarity`: rarity tier.
- `HuntElement`: card element family. Keep the active set small and readable: `FLAME`, `WATER`, `NATURE`, `WIND`, `MUSIC`, `LIGHT`, `SHADOW`.
- `HuntMissionKind`: post/reaction/place/streak/tutorial kinds.

## Server-Authoritative Economy

Clients can request actions, but the server owns all game outcomes:

- Creating a post writes the post and reward ledger transaction.
- Creating a post stores UGC/review fields: media URLs, rating, price band, mood tags and GPS confidence.
- Liking a post checks uniqueness and writes reaction/reward effects.
- Reporting a post can flag it for moderation.
- Moderation can hide/remove a post and reverse post-created NearCoin.
- Opening a box spends/updates the box and rolls one card inside a transaction.
- Upgrading a card spends NearCoin and increases level/stats in a transaction. Growth is rolled against species predisposition, not client input.
- Tutorial completion grants onboarding rewards only once.
- Mission progress and rewards should be calculated server-side.

Never trust client-provided NearCoin, rarity, stats, card levels or mission completion.

## Scaling Notes

The schema is designed so early local launch can grow without an immediate rewrite:

- Ledger rows are append-only, so balance disputes can be audited.
- Posts and places have location fields for future geohash/radius indexes.
- Places can start user-generated and later be claimed by companies.
- Species are templates, while cards are owned instances with individual permanent stats.
- Species `baseStats` are not the card's live stats; they describe growth predisposition for health, attack, luck and evasion.
- Active species must not reuse the same character art. Repeated card drops are allowed, but each species needs a unique `imageUrl`.
- Moderation state is separate from publication state.
- Missions are seeded definitions, not hard-coded UI steps.

Future heavy-load improvements:

- Add geohash or PostGIS for nearby feeds.
- Add denormalized counters for post likes, place activity and card collection summaries.
- Add event ingestion for anti-fraud scoring.
- Move image/media storage to persistent object storage.
- Add background jobs for mission progression and reward settlement.

## Anti-Abuse Requirements

The game economy must resist cheap farming:

- Daily reward caps per profile.
- Unique-user weighting for likes.
- Lower reward for reciprocal like rings.
- Duplicate text/photo/place detection.
- GPS proximity scoring for rewarded posts.
- Trust levels before high-value rewards.
- Report and moderation queues.
- Shadow limiting for suspicious profiles.
