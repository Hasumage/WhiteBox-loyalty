# Nearloy Hunt Economy And Balancing

## Currency

Current currency: `NearCoin`.

NearCoin is a game currency created from trusted social activity. It is not cash, cashback, investment value or a crypto token.

Primary earning sources:

- First tutorial completion.
- Creating eligible posts, currently capped by daily post reward limit.
- Receiving trusted Nearloy likes, currently capped by daily like reward limit.
- Completing missions.
- Future streaks and events.

Primary sinks:

- Opening boxes.
- Upgrading cards, currently priced by card level and rarity.
- Future event entries.
- Future cosmetic frames/effects.

## Ledger Rule

All NearCoin changes must be written through `HuntCurrencyLedger`.

The ledger should store:

- Profile.
- Amount.
- Reason.
- Related post/box/card/mission where relevant.
- Timestamp.
- Metadata for future audit.

The balance on `HuntPlayerProfile` is a cached current balance. If there is ever a dispute, the ledger is the source for reconstruction.

## Box Rules

Boxes are owned by profiles and opened once.

Opening rules:

- The client sends only the box UUID.
- The server verifies ownership and status.
- The server rolls species, rarity and stats.
- The server marks the box as opened and creates a card in one transaction.
- Expired boxes cannot be opened.

Early box types:

- Onboarding box.
- Daily box.
- Mission box.
- Event box.
- Sponsored box, later only.

## Rarity

Rarity should make collection exciting without making early users feel punished.

Suggested launch distribution:

- Common: 58-65%.
- Uncommon: 23-28%.
- Rare: 8-12%.
- Epic: 2-4%.
- Legendary: under 1%.

Adjust through server configuration or DB-backed rules before launch. Do not hard-code client-side rarity odds.

## Stats

Owned cards currently use four permanent stats:

- Health.
- Attack.
- Luck.
- Evasion.

`HuntCreatureSpecies.baseStats` is a `1..10` predisposition profile, not the live card stat block. For example, an attacking creature can have high attack predisposition and lower health predisposition. The total predisposition budget per species must not exceed `35`, and no species may use a perfect `10/10/10/10` profile. When a box is opened, the server rolls permanent `HuntCard.stats` for that exact copy using the species profile, rarity and randomness.

## Reward Constraints

Anti-farm rules must sit on the server:

- Daily post reward caps.
- Daily like reward caps.
- Unique liker weighting.
- Low reward for repeated same-place posts.
- Lower reward for reciprocal reaction clusters.
- No reward for self-like patterns.
- Delayed settlement for suspicious posts.
- Trust-level multipliers.

## Upgrade Direction

A simple upgrade loop:

1. Spend NearCoin.
2. Increase card level.
3. Roll `+0..+3` growth for each stat; higher species predisposition means better odds of gaining points in that stat.
4. Unlock visual frame or title at level milestones.

Focused upgrades can spend extra NearCoin to target one chosen stat. The chosen stat gets an additional growth roll, still influenced by its predisposition. Max card level is `30`.

Future upgrades can require category activity:

- Cafe creatures upgrade faster from cafe posts.
- Route/discovery creatures upgrade from new places.
- Event creatures upgrade from time-limited missions.

## Implemented V1 Constants

Current server constants live in `apps/api/src/hunt/hunt.service.ts`:

- Post create reward: `35` NearCoin.
- Like author reward: `8` NearCoin.
- Standard box cost: `120` NearCoin.
- Daily post limit: `8` posts.
- Daily post reward cap: `175` NearCoin.
- Daily like reward cap: `800` NearCoin.
- Max card level: `30`.
