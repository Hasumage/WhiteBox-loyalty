# Nearloy Hunt API

The first API lives in the Nest app under `apps/api/src/hunt/*`. Gameplay write routes require the regular authenticated user context. Media reads and share payloads are public read-only routes.

Base path:

```text
/api/hunt
```

## Endpoints

### `POST /api/hunt/training` (Next.js, not Nest)

Independent reward-free tactical arena. Start: `{ "action": "start" }`. Optionally send three `teamUuids` (authenticated owner required), or `previewSpeciesId` (HUNT administrator required). Submit a turn: `{ "action": "round", "token": "<signed snapshot>", "orders": [...] }`. Response: `{ battle, token, frames }`. The wire field `round` counts turns. Modified, expired, terminal or pre-v7 snapshots and invalid orders return HTTP 400. Missing ability content returns 503. Legacy `bonus` values are rejected.

The server validates ownership, path, range, targets, cooldown and shared resonance budget, plans the AI without player orders and resolves all effects. Snapshot HMAC namespace: `hunt-training-v7`; two-hour lifetime. Set the same `JWT_SECRET` on all instances. Critical rolls use a separate HMAC domain plus match nonce, turn and attacker/target IDs; repeat submissions cannot reroll that pair. No random seed or next-roll value is returned to the client.

Frames include optional `critical` and `covered` on attacks, `absorbed` shield damage, and `displace` events with `targetId`, `path`, `amount` (cells), `displacement: "push" | "pull"`. `Battle.statistics` accumulates damage, healing, absorption and control per unit. Spent resonance and control score remain separate. Battle starts read ability definitions from DB and snapshot them; turns remain transient, with no economic rewards. Apply the ability migration and seed before serving starts. Rewarded PvP still needs persistent matches and atomic turn submission. See [Tactical Arena](./tactical-arena.md).

### `GET /api/admin/hunt/characters/:uuid/abilities`

Requires HUNT `canView`. Returns the three ordered definitions with current revision, JSON config and latest 20 history snapshots. Missing species: 404.

### `PUT /api/admin/hunt/characters/:uuid/abilities`

Requires HUNT `canEdit`. Body is exactly three complete editable definitions, including IDs, slots, expected revisions and schema version. All three save atomically with assignment reorder, immutable history and audit event. Invalid values, unknown effect fields or foreign assignments: 400. Stale revision: 409 with no partial update. Restore by submitting a prior snapshot with the current expected revision. [Fields and limits](./ability-framework.md).

### `GET /api/hunt/overview`

The `cards` field is a home preview limited to 12 instances. Never use it as the full collection or the squad-selection source. Authenticated `GET /api/hunt/cards/collection` returns **20 cards per page**, including duplicate instances, scoped to the current owner. Parameters: `page` (positive integer), `sort` (`rarity`, `level`, `name`, `element`, `newest`), `element` (enum or `all`), `locale` (`ru`/`en`), `query` (up to 100 characters). Filtering and sorting happen in PostgreSQL BEFORE pagination, with UUID as a stable final tie-breaker. Response: `{cards,total,filteredTotal,page,pages,speciesCounts}`. `total` counts the full collection; `filteredTotal` controls filtered pagination. Out-of-range pages clamp to the last page. Search/sort/filter changes reset the UI to page one. Both collection and squad selection use this endpoint; selected squad members remain selected across pages.

Returns the user's Hunt home state:

- Player profile.
- Current NearCoin balance.
- Missions.
- Available boxes.
- Card collection preview.
- Seeded category/species/place context needed by the UI.

If the profile does not exist, the server creates it.

### `POST /api/hunt/tutorial/complete`

Marks the first-run tutorial as completed and grants onboarding rewards when eligible.

Server rules:

- Tutorial rewards must only be granted once.
- The client cannot choose reward amounts.
- Any onboarding box/currency write must happen in a transaction.

### `GET /api/hunt/feed`

Returns published Hunt posts for the mobile feed.

Expected evolution:

- Nearby feed by coordinates.
- Friends/local feed.
- Category filters.
- Moderation-aware visibility.
- Cursor pagination.

### `GET /api/hunt/places`

Searches or lists active Hunt places.

Query:

```text
?q=coffee
```

Returns user-suggested, seeded and future company-linked places with category/company context.

### `POST /api/hunt/places`

Creates or upserts a user-suggested Hunt place.

Current payload shape:

```json
{
  "name": "Quiet Coffee",
  "address": "Tverskaya 1",
  "city": "Moscow",
  "district": "Center",
  "categorySlug": "coffee",
  "latitude": 55.751244,
  "longitude": 37.618423,
  "tags": ["coffee", "quiet"]
}
```

### `POST /api/hunt/geocode`

Validates and normalizes a one-line user-entered Hunt address through Yandex Geocoder.

Current payload shape:

```json
{
  "address": "Moscow, Tverskaya 1"
}
```

Returns:

```json
{
  "address": "Russia, Moscow, Tverskaya street, 1",
  "latitude": 55.7578,
  "longitude": 37.6134,
  "precision": "exact",
  "name": "Tverskaya street, 1",
  "description": "Moscow, Russia"
}
```

Server responsibilities:

- Use the configured Yandex Geocoder key.
- Reject short, unresolved or invalid addresses.
- Return normalized address and coordinates for post creation and Yandex Maps links.

### `POST /api/hunt/media`

Uploads one Hunt image to server-side storage. The post composer allows up to 3 attached photos.

Current payload shape:

```json
{
  "fileName": "place.jpg",
  "contentType": "image/jpeg",
  "dataBase64": "..."
}
```

Server responsibilities:

- Validate allowed image content type.
- Reject empty files.
- Reject files over the current size limit.
- Store the image under local Hunt media storage.
- Return a URL that can be attached to `photoUrl` or `mediaUrls`.

### `GET /api/hunt/media/:fileName`

Reads uploaded Hunt media.

This endpoint is intentionally public-readable so mobile feed images can render without custom authorization headers in `<img>`/image elements. Uploading remains authenticated.

### `GET /api/hunt/share/posts/:uuid`

Public read-only payload for a Hunt post share page.

Server rules:

- Only returns published posts with `CLEAR` moderation status.
- Does not expose private user fields.
- Includes place, category, author display name, media URLs, rating, tags, coordinates and social counters.

### `GET /api/hunt/share/cards/:uuid`

Public read-only payload for a Hunt card share page.

Server rules:

- Returns card, species, stats and owner display name.
- Does not mutate card state or grant rewards.
- Can be used by public frontend pages and future Telegram/Max preview cards.

### `POST /api/hunt/posts`

Creates a Hunt post.

Current payload shape:

```json
{
  "placeName": "Quiet Coffee",
  "address": "Россия, Москва, Тверская улица, 1",
  "categorySlug": "coffee",
  "caption": "Short place post",
  "photoUrl": "/api/hunt/media/example.jpg",
  "mediaUrls": ["/api/hunt/media/example.jpg"],
  "rating": 5,
  "moodTags": ["cozy", "useful"],
  "latitude": 55.7578,
  "longitude": 37.6134,
  "locationAccuracy": 42,
  "tags": ["coffee", "food"]
}
```

Server responsibilities:

- Validate ownership/authentication.
- Treat `placeName` as optional and derive a safe internal place name from address or caption when absent.
- Validate the primary category when provided and keep extra selected categories as post tags.
- Save GPS/place context from explicit geolocation attachment or checked address coordinates.
- Save up to 3 media URLs, rating and mood/vibe tags.
- Calculate GPS confidence.
- Set moderation/publication state.
- Grant eligible post reward through `HuntCurrencyLedger` within the daily post reward cap.
- Advance related mission progress.

### `POST /api/hunt/posts/:uuid/like`

Creates a Nearloy-like reaction for a post.

Server responsibilities:

- Enforce one reaction of the same type per profile/post.
- Avoid rewarding the post author for suspicious/self-driven activity.
- Write NearCoin rewards from trusted likes within the daily like reward cap.
- Update mission progress.

### `POST /api/hunt/posts/:uuid/report`

Reports a Hunt post for moderation.

Current payload shape:

```json
{
  "reason": "OTHER",
  "details": "Reported from Hunt feed."
}
```

Server responsibilities:

- Enforce one report per user/post.
- Move the post to `FLAGGED` or `REVIEWING` depending on active report count.
- Keep the post available for admin moderation.
- Queue an admin Telegram chat notification through the existing `telegramMessageQueue` delivery mechanic using `TELEGRAM_ADMIN_CHAT_ID`.

### `POST /api/hunt/boxes/open`

Opens a granted box or buys and opens a shop box, then creates a card instance.

Current payload shape:

```json
{
  "boxUuid": "uuid",
  "boxType": "CATEGORY"
}
```

`boxUuid` is used for already granted boxes. `boxType` is used by the shop when buying a new box with NearCoin.

Current shop box types:

- `POST`: basic city box, `120` NearCoin, `COMMON+`.
- `CATEGORY`: rare violet box, `300` NearCoin, `UNCOMMON+`.
- `TRENDING`: resource chest, `650` NearCoin, `RARE+`.
- `DISTRICT`: weekly gold chest, `900` NearCoin, `EPIC+`.

Server responsibilities:

- Verify granted boxes belong to the user and are unopened/unexpired.
- Charge NearCoin for shop boxes.
- Roll species, rarity and stats on the server.
- Mark the box as opened.
- Create one `HuntCard`.
- Return the created card and updated economy state.

### `POST /api/hunt/cards/upgrade`

Upgrades an owned card by spending NearCoin.

Current payload shape:

```json
{
  "cardUuid": "uuid"
}
```

If `cardUuid` is omitted, the server chooses the user's strongest owned card.

Server responsibilities:

- Verify ownership.
- Reject locked or max-level cards.
- Calculate upgrade cost from level and rarity.
- Spend NearCoin through `HuntCurrencyLedger`.
- Increase level, XP and stats in one transaction.

### `GET /api/hunt/cards/catalog`

Returns all active creature species and the current user's duplicate count per species.

Server responsibilities:

- Read active `HuntCreatureSpecies` rows from the database.
- Count owned `HuntCard` instances grouped by species for the requesting user.
- Return base rarity, element, base stats, category and `ownedCount`.
- Keep duplicate cards as separate `HuntCard` records; this endpoint only aggregates them for catalog display.

### `GET /api/hunt/growth/places`

Admin-only growth report for places with organic Hunt demand.

Returns:

- Place identity and category.
- Linked company, if already claimed.
- Published post count.
- Like count and wanted count.
- Unique authors and reactors.
- Last post date.
- `demandScore` and `acquisitionHint`.

This endpoint is intended for company acquisition workflows: "people are already posting about your place, claim it and sponsor the next loop."

The first admin UI for this report is embedded in `/admin/growth` as the Nearloy Hunt demand block.

### `GET /api/hunt/moderation/posts`

Admin-only moderation queue for flagged/reviewing posts and open reports.

The `/admin/hunt` UI uses this payload to show post media, author, place context, active reports and moderation status.

### `PATCH /api/hunt/moderation/posts/:uuid`

Admin-only moderation action.

Current payload shape:

```json
{
  "status": "PUBLISHED",
  "moderationStatus": "CLEAR",
  "note": "Reviewed."
}
```

When a post is hidden or removed, the server can reverse previously awarded post NearCoin.

Current admin actions:

- `PUBLISHED` + `CLEAR` keeps the post in the feed and dismisses open reports.
- `HIDDEN` + `ACTIONED` removes the post from the feed without hard removal.
- `REMOVED` + `ACTIONED` removes the post from public surfaces and resolves open reports.

## Frontend Client

Typed client helpers live in `src/lib/api/twa-client.ts`:

- `getCachedHuntOverview`
- `getHuntOverview`
- `getHuntFeed`
- `getPublicHuntSharePost`
- `getPublicHuntShareCard`
- `getHuntCardCatalog`
- `getHuntPlaces`
- `completeHuntTutorial`
- `createHuntPlace`
- `uploadHuntMedia`
- `createHuntPost`
- `likeHuntPost`
- `reportHuntPost`
- `openHuntBox`
- `upgradeHuntCard`

The frontend must treat all returned game state as read-only snapshots. It can optimistically animate UI, but persisted rewards must come from the server response.
