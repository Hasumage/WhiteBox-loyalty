# Nearloy Hunt Local Development

## Database

NH can run on a separate local PostgreSQL database so game experiments do not pollute the main local database.

Create the database:

```bash
npm run db:hunt:create
```

Use this local URL:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nearloy_hunt_dev?schema=public"
NEXT_PUBLIC_HUNT_ENABLED=true
```

An example env file is available:

```text
.env.hunt.local.example
```

## Migrate And Seed

PowerShell example:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/nearloy_hunt_dev?schema=public'
npm run db:migrate
npm run db:seed
npm run db:seed:hunt
```

The normal seed creates demo users, companies and platform data. `db:seed:hunt` adds Hunt species, missions and demo places.

Uploaded Hunt media is stored locally in:

```text
apps/api/storage/hunt-media/
```

Override it with `HUNT_MEDIA_DIR` when needed.

Production should move this to persistent object storage before real user media usage.

## Run Locally

API:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/nearloy_hunt_dev?schema=public'
npm run api:dev
```

Web:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/nearloy_hunt_dev?schema=public'
npm run dev:web
```

Open:

```text
http://localhost:3000/hunt
```

Swagger:

```text
http://localhost:3001/api/docs
```

## Verification

Use the same checks as the rest of Nearloy:

```bash
npm run db:generate
npx prisma validate
npm run api:build
npm run build:web
npm run lint
npm run api:test
```

Manual smoke path:

1. Log in as a seeded client user.
2. Open `/hunt`.
3. Complete tutorial.
4. Create a post with place/category context.
5. Open an available box.
6. Confirm a Hunt Card appears in the collection.
