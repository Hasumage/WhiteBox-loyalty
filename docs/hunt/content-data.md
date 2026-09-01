# Nearloy Hunt Content Data

## Purpose

NH should collect useful local place information as a natural result of play. The player thinks they are posting, earning likes and opening boxes; Nearloy also receives structured place data that can improve discovery, company acquisition and future loyalty flows.

## Primary Content Object

The current primary object is `HuntPost`.

It represents a lightweight post/review hybrid:

- A user-generated post about a real place.
- Optional GPS proof.
- Optional media.
- Caption and tags.
- Category and place context.
- Moderation state.
- Social reactions.
- Reward eligibility.

Do not introduce a separate Hunt review model until there is a clear product distinction between a post and a review. For now, a post can carry review-like signals through tags, caption, category, reactions and future structured fields.

## Data To Capture

Current or near-term post data:

- Author profile.
- Place.
- Category.
- Caption.
- Tags.
- Media URLs.
- Rating.
- Visit price band.
- Mood tags.
- GPS confidence score.
- Latitude and longitude.
- Created/updated timestamps.
- Publication status.
- Moderation status.

Future structured data:

- Visit time window.
- Price impression.
- Crowd/noise level.
- Service speed.
- Mood/use case tags.
- Accessibility notes.
- Photo quality score.
- Duplicate/similarity score.
- GPS confidence score.
- User trust level at posting time.

## Place Intelligence

`HuntPlace` should become the bridge between user activity and company sales.

Useful derived place metrics:

- Number of unique posters.
- Number of unique reactors.
- Repeat visitors.
- Category rank.
- District/city rank.
- Most used tags.
- Media count.
- Last activity date.
- Positive/negative sentiment signals.
- Claim readiness score for B2B outreach.

These metrics can later power company acquisition:

- "People already post about your place in Nearloy."
- "Your category has active demand in this district."
- "Claim your place and sponsor a mission."

The current server-side growth report is `GET /api/hunt/growth/places`. It returns a first acquisition score from posts, likes, wanted count, unique authors and unique reactors. Treat it as a sales signal, not as a billing or ranking source of truth.

The first operator surface is the Nearloy Hunt demand block in `/admin/growth`. It should help a manager quickly separate:

- `priority_outreach` - enough activity to contact the company.
- `warm_lead` - early signal worth watching or lightly testing.
- `watch` - keep collecting user posts.
- `already_claimed` - company is already linked.

## Moderation Inputs

Moderation should see:

- Author identity and trust level.
- Place and coordinates.
- Caption/tags/media.
- Reaction history.
- Duplicate/similarity hints.
- Report reasons.
- Previous author moderation history.
- Reward already granted or pending.

High-risk content should not generate meaningful rewards until approved.

## Legal Data Notes

The public terms and privacy policy must cover:

- Use of user posts and media inside Nearloy.
- Promotional reuse of posts/cards/previews.
- Location processing.
- Storage and deletion rules.
- Reports and takedowns.
- Sponsored content labeling when companies pay for visibility.

Current legal pages were updated for Hunt on `2026-08-28`:

- `/help/terms/users`
- `/help/terms/companies`
- `/help/privacy`
