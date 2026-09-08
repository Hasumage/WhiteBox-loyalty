# Nearloy Hunt: подготовка Railway к миграции

Этот документ фиксирует порядок переноса Nearloy Hunt на новую Railway PostgreSQL базу.

## Способности персонажей: сентябрь 2026

Арена v7 требует миграцию `20260907180000_hunt_ability_framework`. После применения миграций и генерации Prisma выполните `npm run db:seed:hunt-abilities` против нужного `DATABASE_URL`, затем перезапустите приложения. Команда добавляет отсутствующие слоты, не перезаписывая сохранённые настройки. Сейчас это 21 персонаж и 63 способности. Не запускайте публичную арену между созданием пустых таблиц и заполнением слотов: она вернёт 503 `CONTENT_NOT_READY`. Старые подписанные бои нужно начать заново. [Подробности и ограничения](./ability-framework.md).

## Главное решение

Hunt сейчас живет в общей Prisma-схеме Nearloy и использует обычный `DATABASE_URL`.

На Railway не нужен отдельный `HUNT_DATABASE_URL`: если подключить вторую базу только переменной, код все равно не начнет читать из нее, потому что Prisma-клиент один. Для запуска Hunt на новой базе нужно подключить новую Railway PostgreSQL как основной `DATABASE_URL`/`DIRECT_URL` для API и Web.

## Что создать в Railway

1. PostgreSQL service для новой базы.
2. API service из GitHub-репозитория.
3. Web service из того же GitHub-репозитория.

Root build command для обоих сервисов:

```bash
npm run build
```

Root start command для обоих сервисов:

```bash
npm run start
```

Скрипты сами различают API/Web по `RAILWAY_SERVICE_NAME`: если имя сервиса содержит `api`, запускается Nest API, иначе Next.js web.

## Переменные API service

Обязательные:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_URL=${{Postgres.DATABASE_PUBLIC_URL}}
JWT_SECRET=<long-random-secret-min-32-chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_DAYS=7
FRONTEND_ORIGIN=https://nearloy.ru
FRONTEND_ORIGINS=https://nearloy.ru,https://www.nearloy.ru,https://<web-railway-domain>
API_PORT=3001
YANDEX_GEOCODER_API_KEY=<yandex-geocoder-key>
TELEGRAM_BOT_TOKEN=<prod-bot-token>
TELEGRAM_ADMIN_CHAT_ID=<admin-chat-id>
```

Для первого запуска Hunt:

```env
HUNT_SEED_ON_START=true
HUNT_SEED_DEMO_DATA=false
```

После успешного первого запуска и проверки каталога поставить:

```env
HUNT_SEED_ON_START=false
```

`HUNT_SEED_DEMO_DATA=false` защищает продакшен от тестовых авторов, демо-мест и демо-постов. Каталог персонажей и миссии при этом сидятся.

Опционально для загрузок Hunt:

```env
HUNT_MEDIA_DIR=/app/apps/api/storage/hunt-media
```

Если будут реальные пользовательские фото, лучше подключить Railway Volume или перейти на object storage. Без volume Railway-диск нельзя считать постоянным.

## Переменные Web service

Обязательные:

```env
NEXT_PUBLIC_API_URL=https://<api-domain>/api
NEXT_PUBLIC_SITE_URL=https://nearloy.ru
NEXT_PUBLIC_HUNT_ENABLED=true
NEXT_PUBLIC_YANDEX_MAPS_API_KEY=<yandex-maps-js-key>
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_URL=${{Postgres.DATABASE_PUBLIC_URL}}
JWT_SECRET=<same-jwt-secret-as-api>
```

Для РСЯ:

```env
NEXT_PUBLIC_YANDEX_RSYA_ENABLED=true
NEXT_PUBLIC_YANDEX_RSYA_APP_FEED_BLOCK_ID=R-A-19849293-1
NEXT_PUBLIC_YANDEX_RSYA_HUNT_FEED_BLOCK_ID=
NEXT_PUBLIC_YANDEX_RSYA_PUBLIC_HUNT_FEED_BLOCK_ID=
NEXT_PUBLIC_YANDEX_RSYA_PARTNERS_FEED_BLOCK_ID=
NEXT_PUBLIC_YANDEX_RSYA_MARKETPLACE_FEED_BLOCK_ID=
NEXT_PUBLIC_YANDEX_RSYA_HUNT_SHOP_BANNER_BLOCK_ID=R-A-19849293-2
NEXT_PUBLIC_YANDEX_RSYA_COMPANY_GO_BLOCK_ID=
```

Если нужно временно выключить рекламу без удаления block id, поставьте `NEXT_PUBLIC_YANDEX_RSYA_ENABLED=false` и заново задеплойте Web service.

## Порядок первой миграции

1. Подключить новую PostgreSQL базу к API и Web.
2. Убедиться, что `DATABASE_URL` и `DIRECT_URL` указывают на одну и ту же новую базу.
3. На API временно поставить `HUNT_SEED_ON_START=true`.
4. Деплоить API. При старте выполнится `prisma migrate deploy`, затем `npm run db:seed:hunt`.
5. Деплоить Web.
6. Проверить:
   - `GET https://<api-domain>/api/health`
   - `/admin/hunt`
   - `/admin/hunt/characters`
   - `/hunt/public`
   - `/hunt` после входа пользователем
7. Вернуть `HUNT_SEED_ON_START=false`.

## Что не запускать на проде без явного решения

```bash
npm run db:seed
npm run db:seed:map-demo
```

Эти сиды создают демо-пользователей, компании и демо-контент. Для Hunt-каталога нужен только:

```bash
npm run db:seed:hunt
```

## Быстрый откат

Если миграция не прошла:

1. Вернуть API/Web `DATABASE_URL` и `DIRECT_URL` на старую Railway PostgreSQL базу.
2. Перезапустить сервисы.
3. Выключить `HUNT_SEED_ON_START`.

Миграции Prisma не откатываются автоматически, поэтому на новую базу лучше переключаться только после успешной локальной проверки `npm run db:validate`, `npm run api:build`, `npm run build:web`.
