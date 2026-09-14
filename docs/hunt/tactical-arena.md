# Tactical training arena v7

Route: `/hunt/battle/arena`. This training implementation supersedes the old arena mockup. Lobby selection can supply owned character species, normalized to level one and mirrored by the AI. Economic battle endpoints and real opponent matchmaking are not used by training. See [Ability Framework](./ability-framework.md) for database-backed character setup and administration.

## Rules

Terminology: a round is the full battle; a turn is one simultaneous planning/resolution cycle. The state field `round` and API action `round` count turns. Per-ability `cooldowns` contain the next eligible turn.

- Two identical three-character level-one teams. Default: Coffee Ember, Map Tide, Bloom Sprout. A selected owned team uses its species; administrator preview tests any species. Elements modify damage through the explicit counter table below, not hard-coded role restrictions.
- Symmetric 9x9 orthogonal grid, rotated spawns, four high obstacles and four low park planters. Pathfinding.js A* validates paths; high obstacles also block line of sight, low cover does not.
- One order per living character per turn: move, attack, ability, or wait. Missing orders mean wait. Orders can be edited before confirmation.
- Both sides plan from the same public snapshot. AI never receives player orders. Initiative resolves high to low. Equal-speed attacks use a shared snapshot and can mutually eliminate attackers. Equal-speed moves to the same destination both fail. A faster unit can escape a slower attack.
- Movement is an atomic action along a legal path. Same-initiative paths may cross, but destinations must be distinct and no path may cross a tile occupied at that initiative's start.
- Three points at (1,4), (4,4), (7,4). Capture requires a living unit within Manhattan distance one and no opposing unit within that radius. Multiple allies do not multiply income.
- Center yields 2 per turn, sides 1. Each point yields at most 4 per player for the entire match. Exhaustion is permanent and independent for both sides; it stops both resource and score income. An exhausted point can still be contested.
- Income adds resonance and non-spendable control score independently. Abilities spend resonance only. The whole team's orders share one budget. Both teams start at zero resonance. Legacy shield/haste helpers remain in isolated engine tests; the HTTP endpoint rejects bonus orders and neither UI nor AI uses them.
- Elimination wins immediately after turn resolution. After 10 turns higher control score wins; equal score is a draw.

| Character | HP | Attack | Speed | Move | Range |
| --- | ---: | ---: | ---: | ---: | ---: |
| Coffee Ember | 30 | 9 | 3 | 3 | 1 |
| Map Tide | 26 | 7 | 2 | 2 | 3 |
| Bloom Sprout | 38 | 8 | 1 | 2 | 1 |

## Individual Abilities

| Character | Ability | Resonance | Power | Cooldown |
| --- | --- | ---: | --- | ---: |
| Coffee Ember | Щит из лавы | 2 | Self shield: 40% caster max HP | 2 |
| Coffee Ember | Тлеющий уголь | 3 | Single target: 65% attack + burn 30% attack for 2 turns | 2 |
| Coffee Ember | Извержение | 4 | Enemy area, radius 1: 80% attack, push away from caster | 3 |
| Map Tide | Водяное копьё | 3 | Single target: 140% attack, +1 range, initiative 0, push | 2 |
| Map Tide | Водоворот | 4 | Enemy area, radius 1: 80% attack, pull toward caster | 3 |
| Map Tide | Водяной покров | 3 | Allied area, radius 1: shield 30% caster max HP | 2 |
| Bloom Sprout | Подорожник | 3 | Allied area, radius 1: heal 22% caster max HP | 2 |
| Bloom Sprout | Ядовитый шип | 3 | Single target: 35% attack + poison 22% attack for 3 turns | 2 |
| Bloom Sprout | Пробуждение | 3 | Allied area, radius 1: +25% caster attack, +50% speed, +50% luck for 2 turns | 3 |

The table lists initial seed defaults, not immutable runtime values. All abilities consume the character's sole action. Costs and cooldowns commit at order confirmation, even if the caster dies or a target escapes. A cooldown of 2 used on turn 1 becomes available on turn 4; other abilities retain their own cooldowns. Targets must have the configured side, be alive, in range and (unless disabled in the definition) in line of sight. Area splash uses Manhattan radius around that target; secondary targets do not need separate line of sight. The definition controls affiliation for all its effects. The AI uses the same owned loadouts and budget validation.

Runtime definitions come from `HuntAbility` and `HuntSpeciesAbility`, loaded by `battle-content.ts` into a signed match snapshot. `/admin/hunt/characters` edits all three slots, localized metadata and composable effects with version history. The pure engine exposes `abilityFor` and `loadoutFor`; the old `ABILITIES`/`LOADOUTS` registry remains seed defaults and standalone test support, not the runtime source of truth. Power is `max(1, round(currentStat * factor + flat))`; descriptions show current values. See [all settings, limits and deployment](./ability-framework.md).

Default burn ticks on the next two turn ends and is absorbed by shields. Default poison ticks on the next three turn ends, ignores shields, and reduces healing by 30%. Duration, activation delay and poison penalty are editable. DOT resolves before point income; no immediate tick on application. Shields do not add; duration is configurable. Healing caps at max HP and never revives. Lifesteal heals the caster from actual health damage after shields and overkill, is reduced by poison, and cannot revive a caster killed at equal initiative. Status families support refresh or replacement; attack, speed and luck buffs are separate families. Equal-speed effects use a shared snapshot and buffs cannot retroactively change this turn's initiative.

`ELEMENT_COUNTERS` is the authoritative counter table. Each of the five base elements has two outgoing and two incoming advantages; no pair of base elements mutually counters. Fire counters nature/music; water counters fire/music; nature counters water/wind; wind counters fire/water; music counters nature/wind. Light and shadow mutually counter each other, never themselves, and remain neutral against the base five. Advantage adds 20% to direct and periodic damage without an extra reverse penalty.

## Critical Hits

Base luck is 10. There is no accumulated critical charge. For each directly hit target:

```text
chancePercent = clamp(5 + 0.75 * (attackerLuck - defenderLuck), 1, 25)
criticalMultiplier = 1 + 0.03 * attackerLuck
critical = serverRoll < chancePercent / 100
damage = round(round(power * elementalMultiplier * criticalMultiplierIfTriggered) * (1 - cover))
```

Shield absorption follows damage calculation. Defender luck reduces chance, not the multiplier. Luck 10 vs 10 gives 5% / x1.30; 10 vs 1 gives 11.75% / x1.30; 20 vs 10 gives 12.5% / x1.60; 40 vs 10 gives 25% / x2.20. Before rounding, expected damage multipliers for these examples are 1.015, 1.03525, 1.075 and 1.30. These coefficients are initial tuning, not a claim that attack and luck upgrades have equal economic value. Training has fixed stats, with temporary buffs; collection progression is not connected.

AoE rolls independently per target; DOT never crits. The endpoint derives a uniform 32-bit roll with HMAC-SHA256, a secret key, match nonce, turn and attacker/target IDs. The public nonce is not the RNG secret. Replaying or changing other orders cannot reroll that pair on the same turn. Simulation/tests inject their own RNG; client previews and AI never receive future rolls.

## Cover And Displacement

Low cover at (2,3), (6,3), (2,5), (6,5) is impassable. It reduces direct ranged damage by 30% when the projectile line crosses that cover and the target is orthogonally adjacent to it. It does not block sight, protect against adjacent melee, reduce DOT, or multiply with other cover. Flanking bypasses protection. Existing high obstacles still block sight completely.

Push/pull distance is `clamp(round(current caster speed * 0.5), 1, 2)` cells. Direction follows the dominant caster-to-target axis, X on ties; push goes away, pull toward the caster. Each step stops at high obstacles, low cover, a living unit or the map edge. No collision damage or chain pushing. Even shield-absorbed direct hits can displace surviving targets. Dead targets do not move.

For each initiative group, normal moves and hits resolve first, then displacement against one post-hit board. Multiple forces on the same target cancel; intersecting forced paths cancel, without favoring the player or bot. A separate frame animates displacement after the impact. Slower actions revalidate their range/path from their displaced position; capture uses final positions. Previews are current-board estimates and may differ after earlier actions.

Previews show routes, steps, shields, healing, normal-to-critical damage ranges, critical chances and cover mitigation. Amber dashed paths and landing circles show estimated displacement. Actual critical hits have a distinct impact and exclamation point. The camera tracks action participants within map bounds and yields to manual gestures; forced movement follows the hit. These are not promised outcomes against unknown enemy orders. Failed attacks distinguish range, blocked sight and eliminated targets; failed moves distinguish collision and newly occupied paths. Snapshot signatures use namespace v7: older sessions must restart. Migration `20260907180000_hunt_ability_framework` and the dedicated ability seed are required.

The info button or a hold on a map character opens an animated bottom status panel: health, shield and effects with remaining turns. Match results list actual damage, effective healing, shield absorption and shared point-control contribution for all six characters. No result statistic alters control score or grants rewards.

## Server

`src/lib/hunt/tactics.ts` is a pure shared rules module. Client calculations only highlight legal actions; `POST /api/hunt/battle/match` validates and resolves on the Next.js server. `HuntBattleMatch` stores durable match state, selected teams, pending orders, deterministic seed and last frames. Training grants no rewards. Random PvP searches compatible waiting squads by average team power, falls back to a scaled temporary AI opponent after a randomized 20-30 second wait, and settles NearCoin/trophy rewards once per side when the battle finishes. Private-code PvP uses the same durable state and resolves only after both players submit the turn. `POST /api/hunt/training` remains as a legacy admin preview path.

The deterministic AI evaluates point income, contesting, threat, distance, lethal attacks and shielding. It uses the same movement, attack, bonus and exhaustion validators. Unit IDs and sides are explicit so the model can later be extended to multiple players per team. This version supports training versus AI, private-code PvP over polling and random PvP with temporary bot fallback.

The arena uses one portrait mobile layout, capped at 430px even in a wide browser. Graphite-black surfaces and cyan accents match Hunt. Map gestures use react-zoom-pan-pinch: pinch, drag and zoom/center controls. Minimum scale covers the viewport; camera bounds prohibit empty space beyond the map, including overscroll. Tapping an available tile orders movement; tapping an in-range opponent orders an attack, without a mode selector. Text uses the existing i18n dictionary (Russian and English). Rules and the turn log are available from the arena.

## Verification

Action descriptions appear after a 400ms press above the bottom panel, with an 180ms fade/slide and a subtle hold highlight. There is no modal, backdrop, focus transfer or layout shift. Releasing hides the description and never issues an order. Moving more than 12px, blur or pointer cancellation ends the hold. Short taps retain normal behavior. Reduced-motion preferences are respected. Keyboard users can hold F1 on a focused action. Browser checks cover unavailable abilities, actual touch holds, release, paid skills, budget reservation/refund and cooldowns using server-produced snapshots.

`node scripts/simulate-hunt-tactics.mjs` runs five policies (balanced, center, split, focus, defense), 20 seeded variations per pair, both orientations: 400 matches. Seeds control AI preferences and target-specific critical rolls, mapped by policy/kind rather than side for paired comparisons. Production uses server-secret HMAC instead. `--no-skills --baseline` disables abilities. Reports are generated under `output/hunt-arena/balance-*.{json,md}`. The original baseline predates this ruleset.

Unit tests: `node node_modules/jest/bin/jest.js --config jest.web.config.cjs --runInBand --runTestsByPath src/lib/hunt/tactics.spec.ts src/lib/hunt/abilities.spec.ts src/lib/hunt/combat-effects.spec.ts --roots src/lib/hunt`. Browser/API verification: `node scripts/verify-hunt-arena.mjs` (Playwright installed, or set `PLAYWRIGHT_MODULE` to its module entry point). The UI fixture isolates unrelated authentication shell requests and loads a server-earned funded snapshot for paid skill tests; turn resolution remains real. It also verifies replay stability.

September 7 v5 simulation: 400 matches, zero mirrored outcome mismatches. Score rates (win + half draw): balanced 68.75%, center 28.125%, split 75%, focus 21.25%, defense 56.875%. Equal side access does not mean equally strong policies. Split remains strongest; human tests and further map/AI tuning are still needed.

September 7 v3 simulation: 400 matches, 200 mirrored pairs, zero mirrored outcome mismatches. Score rates (win + half draw): balanced 50%, center 43.8%, split 66.3%, focus 43.8%, defense 46.3%. Split is noticeably stronger on this map; these results do not establish final balance or replace human playtesting. The September 6 report describes the previous free-ability version, not this ruleset.

## Art

The header now opens the visual counter chart instead of a list of rules. `public/hunt-assets/ui/element-counters-v4.png` contains original flat ornamental elemental glyphs, five large outer elements with two smaller targets below each, and Light/Shadow joined by a bidirectional arrow in the center. No percentage is printed on the image. Its localized alt text lists all relationships. Keep the chart and alt text synchronized with `ELEMENT_COUNTERS`; the older `element-crit-ring*` assets use different rules and are not used by this arena.

Built-in imagegen generated `public/hunt-assets/battle/resonance-park.png`.

New cover sprite: `public/hunt-assets/battle/park-cover.png`, generated with the built-in imagegen tool, transparent background. Prompt: "Create one production game sprite: a LOW square grey stone flower planter in a charming stylized modern city park, orthographic straight top-down bird's eye view, not isometric. Small compact lush leaves and a few restrained pink flowers inside a thick cool grey stone rim with subtle pale turquoise inlays. Crisp chunky readable forms at 50px size, tasteful hand-painted 3D game art, natural daylight, tiny soft contact shadow. Entire object visible centered filling 90% of a square canvas. Genuinely transparent alpha background, no ground tile, no scenery, no lettering, no UI, no military objects, no bunker. This sprite is a low defensive cover obstacle placed on grey stone courtyard paving. Only ONE square planter."

Prompt: "Top-down orthographic square stylized 3D urban park courtyard, symmetric under 180-degree rotation; open muted gray paving over the central 80%, three subtle circular plazas across the middle, larger center plaza; green trees, pink shrubs, benches and lanterns at the edges only. Soft daylight, tactile miniature materials, silver-gray stone with cyan details and coral accents. No characters, UI, grid, text, logos or perspective tilt."
