# Nearloy Hunt UI Guidelines

## Design Goal

NH should feel like Nearloy first and a game layer second. The game adds delight, collection and progression, but it should still live naturally inside the mobile client.

Keep:

- Dark Nearloy background.
- Glass panels and restrained glow.
- Cyan/electric blue as the main brand signal.
- Compact mobile-first controls.
- Clear tabs, buttons, counters and cards.
- Premium city-tech feeling.

Avoid:

- Realistic tactical characters.
- Human business avatars as card characters.
- Generic fantasy UI that stops feeling like Nearloy.
- Overly childish toy styling.
- One-color screens where everything is blue/purple.
- Text-heavy instructional panels.

## Creature Direction

Hunt Cards are cute stylized monsters. They should be varied by silhouette, element, rarity and category. Reusing the same character image for different species is not acceptable.

Active elements:

- Fire.
- Water.
- Nature.
- Wind.
- Music.
- Light.
- Shadow.

Allowed character directions:

- Coffee/ember creature for cafes.
- Map/tide creature for discovery and walking routes.
- Bloom/sprout creature for wellness, beauty and calm places.
- Neon/echo creature for nightlife and events.
- Receipt/munch creature for shopping and deals.
- Sweet/orbit creature for desserts and celebrations.
- District/lumen creature for city reputation.

Each species should have:

- Distinct body shape.
- Distinct element palette.
- Expressive face.
- Simple readable silhouette at mobile card size.
- Room for rarity frame and stat badges.

Current generated assets live in `public/hunt-assets/cards/`:

- `coffee-ember.webp`
- `water-route.webp`
- `nature-sprout.webp`
- `neon-sound.webp`
- `receipt-munch.webp`
- `sweet-comet.webp`
- `compass-light.webp`

Additional unique creature portraits live in `public/hunt-assets/cards/creatures/`.

## Card Design

Cards should include:

- Creature image.
- Species name.
- Rarity.
- Element.
- Level.
- Main stats.
- Source place/category when useful.

Use rarity as accent, not as a full-screen palette takeover.

Suggested rarity treatment:

- Common: clean silver/blue rim.
- Uncommon: green/cyan rim.
- Rare: blue/magenta rim.
- Epic: violet/gold rim.
- Legendary: gold/white glow, used sparingly.

## Tutorial

The tutorial should explain the loop through actions, not long text:

- Post about a place.
- Earn Nearloy likes.
- Convert attention into NearCoin.
- Open a box.
- Get a Hunt Card.
- Upgrade through missions.

The first-run tutorial should grant the first box on the server. The UI can celebrate the reward, but the backend decides if it is eligible.

## Main Screen

The `/hunt` screen is the Hunt feed first. It should expose:

- Local feed.
- Compact quick navigation to dedicated Hunt subpages before the feed.
- NearCoin balance in the header.
- Visual action cards below the feed, using generated/post/box/card imagery instead of plain stat tiles.

Dedicated subpages:

- `/hunt/create` - three-step post creation: place, media, story.
- `/hunt/shop` - reward shop with multiple box types, generated box artwork and server-side opening.
- `/hunt/cards` - collection, upgrades and card sharing.
- `/hunt/all-cards` - player-facing catalog of every active creature species and owned duplicate counts.

Post creation, card collection, reward shop and box opening should not be the primary content of `/hunt`.

The post composer should not be one long form. Keep each step focused, icon-led and mobile-first.

Composer rules:

- Place name is optional because the post text can name the place.
- Address is a single line and should be checked through `/api/hunt/geocode`.
- Geolocation is attached only after the user taps the attach button; never claim GPS is attached before success.
- Categories are selected in a popup, not as a large inline grid.
- Media step supports up to 3 server-uploaded photos.
- Story step has one labelled tags/vibe input, not separate duplicate tag and mood fields.

Shop rules:

- Show NearCoin balance and granted boxes.
- Use distinct generated artwork for each box type.
- Keep costs and minimum rarity floors visible.
- Buying/opening boxes must call the server; rarity and stats never come from the client.

Post and card surfaces should expose:

- Server-side media upload.
- Review/rating fields.
- GPS confidence context.
- Card share actions.
- Post media preview, likes, report dialog, Yandex Maps link and share actions.
- A lightweight growth explanation showing how organic posts become company demand proof.

Feed post rules:

- Show hashtags once by merging mood/vibe tags and regular tags into a unique display list.
- The report button opens a violation picker with an optional details field for `OTHER`.
- Yandex Maps should open by saved coordinates when available, with address/place search as fallback.
- Forwarding should prefer native share, then Telegram share, then clipboard fallback.

The interface should be usable even if the user has not granted exact GPS yet. GPS improves reward confidence and post quality, but the screen should still load and explain the next useful action.

## Public Share Pages

Public share pages live outside the protected mobile route:

- `/hunt-share/post/:uuid`
- `/hunt-share/card/:uuid`

They should look like Nearloy Hunt, stay compact, and only use public read-only API payloads. A hidden or removed post should render an unavailable state instead of leaking moderation details.
