# Character And Ability Framework

Implemented September 7, 2026. Ability schema version **1**, signed tactical session version **7**. This document describes implemented behavior, not a promise of multiplayer or arbitrary scripting.

## Administration

Open `/admin/hunt/characters`, select a character. The initial tab shows three independently editable ability slots. The character tab retains identity, element, collection affinities and artwork settings. Each ability supports RU/EN names/descriptions, an icon, enable/disable, ordering, targeting and a list of effects. Changes are drafts until Save; closing with unsaved edits requires confirmation. Reset discards the draft. A saved revision can be loaded into the draft and saved as a new revision. Play opens the saved character in a mirrored training match.

The local seed assigns **63 abilities to all 21 existing species**, including shadow lifesteal. Each species has its own definitions, so editing one character does not silently change another. Rerunning the seed fills missing slots but never resets existing administrator edits. New species require running this initializer; there is no automatic write during a public battle request.

## Storage And Concurrency

- `HuntAbility`: stable unique slug, localized metadata, active flag, JSON configuration, schema version and monotonically increasing revision.
- `HuntSpeciesAbility`: species-to-definition assignment, slot `0..2`; composite primary key `(speciesId, slot)` and unique `(speciesId, abilityId)`. SQL checks reject invalid slots. Three slots are enforced by API and battle loader, not by a SQL minimum-row constraint.
- `HuntAbilityRevision`: immutable application-managed snapshots, unique `(abilityId, revision)`, timestamp and actor ID. The editor loads the latest 20 revisions; older history remains in the database.
- A save transaction checks ownership of all definitions, updates with optimistic revision predicates, replaces slot assignments and writes history plus audit event. Any conflict returns 409 and rolls back all three slots. Authorization uses the existing HUNT `canView`/`canEdit` permissions.

Definitions and runtime snapshots are separate. At match start, the server validates database content and copies complete definitions into the signed battle. An edit affects **new** matches only. Battle turns do not query mutable ability data. Schema versions that the engine does not understand fail closed instead of silently substituting a default ability.

## Configuration Reference

All numeric values must be finite. Integer fields reject fractions. Unknown effect/configuration fields are rejected by `src/lib/hunt/ability-config.ts`; client validation is convenience, server validation is authoritative.

| Field | Range / meaning |
| --- | --- |
| `cost` | Integer 0..20 resonance, paid on order confirmation |
| `cooldown` | Integer 0..10 unavailable subsequent turns |
| `target` | `self`, `ally`, `enemy`; selects affiliation for the entire ability |
| `radius` | Integer 0..4 Manhattan cells around the selected target; 0 is single target |
| `maxTargets` | Integer 1..6, nearest to primary target first, symmetric coordinate tie-break |
| `range` | Optional absolute range 0..16; absent uses character range plus `rangeBonus` |
| `rangeBonus` | Integer -8..8, only used without absolute range |
| `lineOfSight` | Default true; toggles sight requirement for the primary target |
| `delayed` | Resolves at initiative 0 instead of normal character speed |
| `effects` | 1..8 effects, at least one enabled; each independently switchable and reorderable |
| `power.stat` | `hp` (maximum HP), `attack`, `speed`, `luck` |
| `power.factor` | 0..10 multiplier of the caster's current stat |
| `power.flat` | 0..100 additive value; factor and flat cannot both be zero |

Power is `max(1, round(currentStat * factor + flat))`. The character's temporary buffs are included at execution. DOT/buff magnitude is snapshotted on application. Effects within a speed group resolve in semantic phases (moves, shields/damage/healing/status application, then forced movement), not as an arbitrary imperative script. Reordering the list does not move healing before damage or alter initiative.

Target affiliation is ability-wide. For example, use an ally-targeted ability for shield + heal. Configuring healing on an enemy-targeted ability deliberately heals the selected enemies; the editor does not reinterpret affiliation. Lifesteal is the exception with a defined caster recipient for its healing portion.

| Effect | Additional settings and behavior |
| --- | --- |
| `damage` | `canCrit` default true; `ignoreCover` default false. Elemental counter multiplier applies. |
| `lifesteal` | Same direct damage options plus `ratio` 0.01..1. Restores caster HP from actual health damage, not shield absorption or overkill. |
| `heal` | Restores actual missing HP, obeys poison reduction, never revives. |
| `shield` | `duration` 0..10 **additional** turns; zero means through current turn end. Shield amounts do not add. Stronger incoming shields replace amount/duration; equal strength can refresh duration; weaker shields do not prolong stronger shields. |
| `burn` | Shield-absorbed periodic damage. `duration` 1..10, `delay` 1..3 turns. No critical hits. |
| `poison` | Periodic damage bypasses shields; `healingReduction` 0..1 (default 0.3). Same duration/delay limits. No critical hits. |
| `buff` | Raises `attack`, `speed` or `luck`; same duration/delay limits. |
| `push`, `pull` | Stat-scaled displacement capped by `maxDistance` 1..4. Obstacles, units and map bounds stop movement. No collision damage. |

DOT and buffs accept `stacking`: `refresh` retains stronger magnitude, earliest activation and latest expiration within a family; poison retains stronger healing reduction. `replace` replaces the family with the new instance. Attack/speed/luck buffs are separate families. Multiple poison penalties do not add. Burn does not support a healing penalty.

Lifesteal is mainly assigned to shadow characters, but any character can be configured with it. It costs resonance like every ability. Healing is rounded from the caster's share of actual HP damage and reduced by poison. It cannot resurrect a caster killed at the same initiative. Simultaneous hits share shield absorption proportionally, preventing unit-array order from favoring one side. Aggregate healing is capped at missing HP; completely suppressed healing produces zero, never NaN statistics.

## Playing And Presentation

- Default training uses the original fire/water/nature trio. Lobby `teamUuids` selects three owned cards; the server verifies ownership, then uses their species at normalized level one on both sides. Collection level and rolled stat advantages are not used.
- Admin-only `previewSpeciesId` places three copies of the selected species on each side. This is a test mode, not matchmaking.
- The original trio retains its established training stat profiles. Other species derive level-one profiles from species affinities in `battle-content.ts`. Editing an ability scales against the resulting current profile, not raw collection stats.
- Hold a skill to see current computed powers, cost, range, duration and effect-specific values. Tap the info icon or hold a map character to inspect HP, shield, effects and remaining turns.
- Resolution camera tracks involved units and movement paths, stays bounded, and yields to manual map gestures. Critical hits use a distinct impact, and forced movement follows the hit in a separate frame. Reduced motion is respected.
- Match results show each character's actual HP damage, effective healing, absorbed shield damage and control contribution. Control income is divided among participating allies rather than duplicated. These statistics do not change rewards or winner calculation.

## Local / Deployment Steps

```sh
npm run db:migrate
npm run db:generate
npm run db:seed:hunt-abilities
```

Migration: `20260907180000_hunt_ability_framework`. It creates new tables without deleting or rewriting characters, cards, boxes or balances. Run against the intended database, then restart web/API processes so they use the generated Prisma client. The initializer is also called by the full Hunt seed, but use the dedicated command when only initializing abilities. Empty assignments make training return `CONTENT_NOT_READY` (503), not a broken partially populated match. Existing pre-v7 signed sessions must restart.

## Verification And Extension

Unit coverage: `ability-config.spec.ts`, `abilities.spec.ts`, `combat-effects.spec.ts`, `presentation.spec.ts`, `tactics.spec.ts`.

Local verification: 74 unit tests passed; all 21 species completed signed server matches. Admin draft controls passed at 1440/390/320px; mobile status, hold, camera motion and six-character results passed at 320/390px. Arena regression checks passed at 320/390/430/1440px. Web production and Nest API builds passed. An earlier broad TypeScript check reported existing mock-type errors in unrelated KYC/referral tests; those tests were not changed by this work.

- `node scripts/verify-hunt-abilities.mjs`: local DB only; all species/slots, complete server matches, authorization, invalid settings, optimistic conflicts/history, snapshot isolation. A temporary cost change is restored with revision protection; audit history is intentionally retained.
- `node scripts/verify-hunt-ability-ui.mjs`: authenticated admin UI drafts and mobile status/results; requires Playwright and a running local server. No saved content changes.
- `node scripts/verify-hunt-arena.mjs`: signed server turns, stable critical replay, map bounds and touch interaction.

Adding a new effect family requires updating its discriminated union, validator, pure resolver, preview, editor fields, translations and tests together. Schema changes require an explicit schema-version migration and compatibility policy. Do not store executable formulas or arbitrary JavaScript in JSON. Persistent PvP matches, seasonal telemetry and AI strategy improvements remain separate future work; this update does not retune the AI.
