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
FRONTEND_ORIGINS=https://nearloy.ru,https://www.nearloy.ru,https://nearloy.up.railway.app
API_PORT=3001
```

Optional variables:

```env
YANDEX_GEOCODER_API_KEY=<key>
EMAIL_PROVIDER=auto
MAIL_FROM=NearLoy <no-reply@nearloy.ru>
RESEND_API_KEY=<resend-api-key>
RESEND_API_URL=https://api.resend.com/emails
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-login>
SMTP_PASS=<smtp-password>
YOOKASSA_SHOP_ID=<shop-id>
YOOKASSA_SECRET_KEY=<secret-key>
YOOKASSA_RETURN_URL=https://<web-domain>/payment/success
YOOKASSA_COMPANY_RETURN_URL=https://<web-domain>/company/billing
YOOKASSA_VAT_CODE=1
YOOKASSA_MAX_BANK_CARD_PAYMENT_RUB=349999
PAYMENT_RECONCILIATION_INTERVAL_MS=60000
PAYMENT_RECONCILIATION_LOOKBACK_HOURS=24
PAYMENT_RECONCILIATION_BATCH_SIZE=50
PAYMENT_METHOD_ENCRYPTION_KEY=<long-random-secret-min-32-chars>
OPENAI_API_KEY=<openai-api-key>
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.4-nano
OPENAI_COMPANY_ASSISTANT_MAX_OUTPUT_TOKENS=420
OPENAI_ADMIN_ASSISTANT_MODEL=gpt-5.4-nano
OPENAI_ADMIN_ASSISTANT_MAX_OUTPUT_TOKENS=680
AI_GATEWAY_SECRET=<long-random-secret-for-server-to-server-ai-gateway>
DAILY_REPORT_SCHEDULER_ENABLED=true
DAILY_REPORT_TIME_MSK=23:00
DAILY_REPORT_SECRET=<same-secret-used-by-admin-daily-report-endpoint>
YOOKASSA_PAYOUT_AGENT_ID=<yookassa-payout-agent-id>
YOOKASSA_PAYOUT_SECRET_KEY=<yookassa-payout-secret-key>
YOOKASSA_PAYOUT_ALLOW_RAW_CARD=false
```

Email delivery is mandatory in production. Use an HTTP provider such as Resend on Railway Hobby because outbound SMTP is
not reliable there. `EMAIL_PROVIDER=auto` tries configured HTTP providers first, then SMTP fallback. If no production
provider is configured, the API returns an error instead of silently saving the message to the local dev outbox.
For provider-specific SMTP routing you may also configure
`YANDEX_SMTP_HOST`/`YANDEX_SMTP_PORT`/`YANDEX_SMTP_USER`/`YANDEX_SMTP_PASS` and
`GOOGLE_SMTP_HOST`/`GOOGLE_SMTP_PORT`/`GOOGLE_SMTP_USER`/`GOOGLE_SMTP_PASS`.

The company AI assistant is optional. Keep `OPENAI_API_KEY` only on the API service. The default `gpt-5.4-nano`
model and compact output token cap keep the four company helper actions inexpensive; raise `OPENAI_MODEL` only when quality is not enough.
The admin AI assistant uses the same OpenAI key unless `OPENAI_ADMIN_ASSISTANT_MODEL` is overridden. It is permission-scoped in the app and still needs regular admin JWT/auth checks.
If local development cannot call OpenAI directly, route local API/web calls through the deployed API gateway:
`OPENAI_GATEWAY_URL=https://<api-domain>/api/internal/ai/responses` and `OPENAI_GATEWAY_SECRET=<same value as AI_GATEWAY_SECRET>`.
Do not set `OPENAI_GATEWAY_URL` on the API service itself, otherwise it can recursively call its own gateway.

Daily Telegram reporting is not automatic unless the scheduler process is running. For Railway, add a small worker/service that runs
`npm run reports:daily:scheduler` with `DAILY_REPORT_SCHEDULER_ENABLED=true`, or trigger `npm run reports:daily:send` from an external scheduler.

YooKassa payouts are currently intended for the test gateway and manual operational validation. Keep manual payout closure enabled for launch;
do not enable raw-card payout mode for real production cards.

The API health endpoint is:

```text
GET /api/health
```

Swagger is available at:

```text
/api/docs
```

YooKassa should send payment webhooks to:

```text
POST https://<api-domain>/api/payments/yookassa/webhook
```

Payment success pages and status reads also synchronize provider status, so a paid order can be applied even when the user closes the YooKassa page instead of returning to NearLoy.

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
For production, include both the custom domain and Railway fallback domain in `FRONTEND_ORIGINS` so API CORS works from `nearloy.ru`, `www.nearloy.ru` and `nearloy.up.railway.app`.
Set the generated web domain in `YOOKASSA_RETURN_URL` and `YOOKASSA_COMPANY_RETURN_URL` so YooKassa returns users to the client payment and company billing status screens.

## Runtime storage

Company media currently writes to runtime storage for logo, hero, gallery and offer images. This is fine for local/demo use. For production with real company uploads, configure persistent storage or move `src/lib/company-media-storage.ts` to an object-storage backend before relying on Railway ephemeral disk.

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
4. Check `/admin/payments`, `/admin/tasks` and `/admin/system-health`.
5. Check `/admin/subscriptions` and `/admin/growth`.
6. Log in as company seed account and check `/company/billing` and `/company/settings/media`.
7. Log in as client seed account.
8. Check dashboard, marketplace, wallet, history, map and public `/wallet/<slug>` in a signed-out browser.
9. Verify API `/api/health`.
10. Send a real email smoke test through the configured provider.
11. Rotate any temporary demo database/API credentials after the investor demo.
