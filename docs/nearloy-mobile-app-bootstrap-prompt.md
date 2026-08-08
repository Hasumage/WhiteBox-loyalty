# NearLoy Mobile App — промпт/ТЗ для отдельного репозитория

Нужно создать **отдельный мобильный проект** `nearloy-mobile`, не встраивая Capacitor/Android/iOS в основной репозиторий NearLoy.

## Главная идея

NearLoy уже существует как веб-приложение на **React / Next.js**. Мобильная версия должна быть тонкой нативной оболочкой, которая открывает актуальный веб-интерфейс NearLoy и добавляет нативные возможности телефона.

Важно: **не копировать основной проект, не переносить туда бизнес-логику и не дублировать backend**.

## Что нужно собрать

Создать новый репозиторий:

```txt
nearloy-mobile
```

Стек:

```txt
TypeScript
Vite или минимальный React shell
Capacitor
Android
iOS
```

Базовые зависимости:

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
npm install @capacitor/app @capacitor/browser @capacitor/device
npm install @capacitor/geolocation @capacitor/push-notifications
npm install @capacitor/share @capacitor/haptics @capacitor/preferences
```

Опционально для QR/штрихкодов:

```bash
npm install @capacitor-mlkit/barcode-scanning
```

## Основной сайт, который открывает приложение

Production web:

```txt
https://nearloy.ru
```

Основная mobile entry-точка:

```txt
https://nearloy.ru/mobile
```

Если `/mobile` пока не готов или пользователь не авторизован — вести на:

```txt
https://nearloy.ru/login
```

Важно: мобильное приложение **не должно открывать лендинг как главный экран**. Оно должно вести пользователя в личный кабинет / авторизацию.

## API

Использовать API через основной домен NearLoy:

```txt
https://nearloy.ru/backend-api
```

Health check:

```txt
GET https://nearloy.ru/backend-api/health
```

Ожидаемый ответ:

```json
{
  "status": "ok",
  "service": "nearloy-api"
}
```

Не использовать напрямую Railway API-домен как основной URL в мобильном приложении:

```txt
https://whitebox-api-production.up.railway.app/api
```

Причина: у части пользователей Railway API-домен может быть недоступен без VPN. Для приложения API должен идти через `nearloy.ru/backend-api`.

## Env-переменные мобильного проекта

Сделать `.env.example`:

```env
VITE_NEARLOY_SITE_URL=https://nearloy.ru
VITE_NEARLOY_WEB_URL=https://nearloy.ru/mobile
VITE_NEARLOY_API_URL=https://nearloy.ru/backend-api
```

Для локальной разработки можно использовать:

```env
VITE_NEARLOY_SITE_URL=http://localhost:3000
VITE_NEARLOY_WEB_URL=http://localhost:3000/mobile
VITE_NEARLOY_API_URL=http://localhost:3000/backend-api
```

## Capacitor config

Идентификатор приложения:

```txt
ru.nearloy.app
```

Название:

```txt
NearLoy
```

Задача shell:

- открыть `VITE_NEARLOY_WEB_URL`;
- держать пользователя внутри домена `nearloy.ru`;
- внешние ссылки открывать через системный браузер;
- принимать OAuth/deep-link возврат `nearloy://...` и открывать его внутри WebView;
- не хранить пароли;
- не хардкодить секреты;
- не добавлять backend в мобильный репозиторий.

Пример логики:

```ts
const NEARLOY_WEB_URL = import.meta.env.VITE_NEARLOY_WEB_URL || 'https://nearloy.ru/mobile';
const NEARLOY_SITE_URL = import.meta.env.VITE_NEARLOY_SITE_URL || 'https://nearloy.ru';
const NEARLOY_API_URL = import.meta.env.VITE_NEARLOY_API_URL || 'https://nearloy.ru/backend-api';
```

## VK ID / OAuth возврат в приложение

Для входа через VK ID backend NearLoy возвращает мобильный callback в custom scheme:

```txt
nearloy://oauth/vkid/complete?ticket=...&app=capacitor
```

Нативный shell должен зарегистрировать URL scheme `nearloy` и на `appUrlOpen` загрузить соответствующий web-route внутри WebView:

```ts
import { App } from '@capacitor/app';

const NEARLOY_SITE_URL = import.meta.env.VITE_NEARLOY_SITE_URL || 'https://nearloy.ru';

App.addListener('appUrlOpen', ({ url }) => {
  const incoming = new URL(url);
  if (incoming.protocol !== 'nearloy:') return;

  const path = `/${incoming.hostname}${incoming.pathname}`;
  const webUrl = new URL(path, NEARLOY_SITE_URL);
  webUrl.search = incoming.search;
  webUrl.searchParams.set('app', 'capacitor');

  window.location.assign(webUrl.toString());
});
```

Важно: ticket должен обмениваться уже на странице `https://nearloy.ru/oauth/vkid/complete?...` внутри приложения, иначе сессия сохранится во внешнем браузере, а не в NearLoy app.

## Важное про автообновления

Нужен вариант, где при изменении веб-приложения NearLoy изменения сразу видны в мобильной апке.

Поэтому MVP делаем как:

```txt
Capacitor native shell + remote WebView на https://nearloy.ru/mobile
```

Это значит:

- интерфейс обновляется через web deploy;
- приложение из стора не нужно пересобирать при обычных изменениях UI;
- новый релиз в App Store / Google Play нужен только при изменении нативных функций: push, геолокация, камера, QR, permissions, app icon, splash screen.

## Нативные функции, которые нужно предусмотреть

### 1. Push notifications

Подготовить модуль для:

- запроса разрешения на уведомления;
- получения push token;
- отправки token в NearLoy API;
- удаления token при logout/отключении уведомлений.

Backend endpoint может быть добавлен позже в основной проект NearLoy.

### 2. Геолокация

Нужна для будущих гео-уведомлений:

- запрашивать разрешение только когда пользователь включает гео-функции;
- не спамить запросами разрешений;
- не собирать гео без явного согласия.

### 3. QR / barcode scanner

Будущий сценарий:

- пользователь показывает QR;
- компания/кассир сканирует QR;
- либо приложение сканирует партнёрский код.

Можно пока заложить модуль, но не обязательно включать в MVP, если текущий web QR уже работает.

### 4. Share

Нативная кнопка “поделиться” для:

- карточки компании;
- приглашения пользователя;
- публичной ссылки `https://nearloy.ru/wallet/{slug}`.

## Что НЕ делать

- Не переносить текущий Next.js проект внутрь мобильного репозитория.
- Не копировать backend.
- Не добавлять БД.
- Не хардкодить токены, ключи OpenAI, YooKassa, Telegram, Resend и другие секреты.
- Не делать отдельную авторизацию, если веб-авторизация работает через текущие cookie/session.
- Не открывать лендинг как главный экран приложения.
- Не пушить изменения в git без отдельной явной команды.

## Что может понадобиться в основном NearLoy проекте

Минимальные изменения в основном проекте могут понадобиться позже:

1. Маршрут:

```txt
/mobile
```

Он должен:

- проверять сессию;
- если пользователь авторизован — вести в нужный кабинет;
- если нет — вести на `/login`;
- не показывать лендинг как основной экран.

2. API endpoint для push token:

```txt
POST /backend-api/notifications/push-token
DELETE /backend-api/notifications/push-token
```

3. Корректная работа cookie/session внутри WebView.

## UX требования

Приложение должно ощущаться как нативное:

- full screen;
- нормальный splash screen;
- иконка NearLoy;
- тёмная тема;
- аккуратный статусбар;
- отсутствие “браузерного” ощущения;
- внешние ссылки открываются отдельно;
- back button на Android работает ожидаемо.

## Проверки готовности

Минимальные проверки:

```bash
npm run build
npx cap sync
npx cap add android
npx cap open android
```

Для iOS:

```bash
npx cap add ios
npx cap open ios
```

Проверить:

- приложение запускается;
- открывается `https://nearloy.ru/mobile`, а не лендинг;
- `https://nearloy.ru/backend-api/health` доступен;
- логин работает;
- сессия сохраняется после закрытия и повторного открытия приложения;
- внешние ссылки не ломают приложение;
- Android back не закрывает приложение случайно на внутренних переходах;
- push/geolocation permissions не запрашиваются без причины.

## Store-ready направление

Для Google Play / App Store приложение не должно выглядеть как “просто сайт в WebView”.

Нужно постепенно добавить нативную ценность:

- push-уведомления;
- гео-уведомления;
- QR-сканер;
- native share;
- сохранённая авторизация;
- быстрый доступ к карте и картам лояльности.

## Итоговая цель MVP

Собрать отдельное приложение NearLoy, которое:

1. Живёт в отдельном репозитории.
2. Открывает актуальный веб-интерфейс NearLoy.
3. Работает через API `https://nearloy.ru/backend-api`.
4. Может быть собрано как Android/iOS приложение.
5. Не засоряет основной проект.
6. Позволяет обновлять интерфейс через web deploy без постоянных релизов в сторы.
