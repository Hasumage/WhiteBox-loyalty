# CI/CD

NearLoy uses GitHub Actions as the production gate.

## Pull requests

Every PR to `main` runs:

1. Start temporary PostgreSQL.
2. Create the Prisma shadow database.
3. Apply all migrations with `prisma migrate deploy`.
4. Generate Prisma Client.
5. Validate Prisma schema.
6. Run ESLint.
7. Build Next.js web.
8. Build NestJS API.
9. Run API tests.

PR checks never touch production data.

## Merge to main

Every push to `main` runs the same full verification. If it passes, CI applies production migrations using:

- `PRODUCTION_DATABASE_URL`
- `PRODUCTION_DIRECT_URL` optional, falls back to `PRODUCTION_DATABASE_URL`

Railway should be configured to deploy `nearloy-api` and `nearloy-web` from `main` after GitHub checks are green.

## Required GitHub Secrets

Set these in GitHub repository settings:

- `PRODUCTION_DATABASE_URL`: Railway public PostgreSQL URL with SSL if required.
- `PRODUCTION_DIRECT_URL`: optional direct/public URL for Prisma. Use the same value as `PRODUCTION_DATABASE_URL` if there is no separate direct URL.

Do not commit production database URLs to `.env`, docs, or workflow files.

## Railway services

Railway services use the root scripts:

- Build: `npm run build`
- Start: `npm run start`

`scripts/railway-build.mjs` and `scripts/railway-start.mjs` select API vs WEB behavior from `RAILWAY_SERVICE_NAME`.
