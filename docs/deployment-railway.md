# Railway deployment

NearLoy is not a static/PHP application. It needs Node.js runtime for both:

- Next.js web app
- NestJS API

The recommended production demo setup is:

- Railway PostgreSQL
- Railway API service
- Railway Web service

## Database

Use the Railway public PostgreSQL URL only in Railway service variables and GitHub Secrets.

Use the internal Railway URL only for services running inside Railway.

Required variables:

```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
```

Production migrations are applied by GitHub Actions after `main` is green. Manual migration is only for emergency operations:

```bash
npm run db:migrate
npm run db:generate
```

Do not run `db:seed` against production unless you intentionally want to replace/demo-fill production data.

Required GitHub Secret:

```text
PRODUCTION_DATABASE_URL
```

## API service

Create a Railway service from the same GitHub repository.

Build command:

```bash
npm run build
```

Start command:

```bash
npm run start
```

Required variables:

```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_DAYS=7
FRONTEND_ORIGIN=https://<web-domain>
API_PORT=3001
```

Optional variables:

```env
YANDEX_GEOCODER_API_KEY=<key>
EMAIL_FROM=no-reply@nearloy.local
```

The API health endpoint is:

```text
GET /api/health
```

Swagger is available at:

```text
/api/docs
```

## Web service

Create a second Railway service from the same GitHub repository.

Build command:

```bash
npm run build
```

Start command:

```bash
npm run start
```

The root `build` and `start` scripts are Railway-aware. They inspect `RAILWAY_SERVICE_NAME`:

- service names containing `api` build/start the NestJS API;
- other service names build/start the Next.js web app.

Required variables:

```env
NEXT_PUBLIC_API_URL=https://<api-domain>/api
NEXT_PUBLIC_YANDEX_MAPS_API_KEY=<key>
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
```

Set the generated web domain as `FRONTEND_ORIGIN` in the API service.

## CI/CD handoff

Railway should be connected to GitHub `main` and configured to wait for GitHub checks.

Expected flow:

1. PR to `main` runs full checks on a temporary PostgreSQL database.
2. Repository owner merges manually.
3. Push to `main` runs full checks again.
4. GitHub Actions applies production Prisma migrations.
5. Railway deploys `nearloy-api` and `nearloy-web` from the same commit.

## Why not FTP/static hosting?

The project cannot be deployed as plain files to a PHP/static host:

- Next.js runs a Node server in this setup.
- NestJS API requires a Node process.
- Prisma runs through Node and connects to PostgreSQL.

FTP/static hosting can be used only for a separate static landing page or redirect.

## Post-deploy checklist

1. Open web service URL.
2. Log in as admin seed account.
3. Check `/admin/companies`.
4. Check `/admin/subscriptions`.
5. Check `/admin/growth`.
6. Log in as client seed account.
7. Check dashboard, marketplace, wallet, history, map.
8. Verify API `/api/health`.
9. Rotate any temporary demo database/API credentials after the investor demo.
