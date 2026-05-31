# Local development

Local development should use a local PostgreSQL database. Production database URLs belong only in Railway and GitHub Secrets.

## One-time setup

```bash
npm install
copy .env.example .env
npm run db:local:up
npm run db:migrate:dev
npm run db:seed
```

The Docker Compose service creates:

- `my_project_database`
- `my_project_database_shadow`

The default local URLs in `.env.example` already point to these databases.

## Run locally

Run API and web in separate terminals:

```bash
npm run api:dev
npm run dev:web
```

Or run both from one terminal:

```bash
npm run dev:local
```

Local URLs:

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/api/health`
- Swagger: `http://localhost:3001/api/docs`

## Useful database commands

```bash
npm run db:local:up
npm run db:local:down
npm run db:migrate:dev
npm run db:status
npm run db:seed
```

Use `db:migrate:dev` only for local development. Production uses `db:migrate` through CI/CD.

## Verification

Run the full local quality gate before opening a PR:

```bash
npm run ci:verify
```

This runs Prisma generation/validation, web unit tests, ESLint, Next build, Nest build and API unit tests.

For targeted web checks during UI/i18n or Telegram work:

```bash
npm run test:web -- i18n menu-notifications telegram
```

## Telegram local development

Telegram Bot API calls can use a local proxy when direct access is unstable:

```env
TELEGRAM_PROXY_URL=http://127.0.0.1:10809
```

Useful checks:

```bash
npm run telegram:ping
npm run telegram:poll:local
```

Never commit bot tokens. Keep them in `.env` or hosting secrets only.

Local polling runs in safe mode by default:

```env
TELEGRAM_LOCAL_POLL_PRIVATE_ONLY=true
TELEGRAM_LOCAL_POLL_COMMANDS_ONLY=true
```

That means the dev bot forwards only private `/start`, Telegram contact shares and callbacks to the local webhook. Group chats, discussion comments and random text are skipped locally, so the bot does not answer them or run unnecessary handlers while you develop.

## Private local storage

Company verification passport files are encrypted and stored in private local storage. These files are local runtime data and must not be committed.

The admin verification screen includes a storage sync action to reconcile encrypted files with database records.
