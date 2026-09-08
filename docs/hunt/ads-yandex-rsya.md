# Nearloy: рекламные блоки РСЯ

## Что подключено

В проекте используется клиентский компонент `YandexRtbAd`. Он загружает официальный скрипт РСЯ:

```text
https://yandex.ru/ads/system/context.js
```

И рендерит блок через:

```ts
Ya.Context.AdvManager.render({
  blockId: "R-A-19849293-1",
  renderTo: "...",
  type: "feed",
});
```

## Переменные окружения

Реклама включается только явным флагом:

```env
NEXT_PUBLIC_YANDEX_RSYA_ENABLED=true
```

Основной feed-блок:

```env
NEXT_PUBLIC_YANDEX_RSYA_APP_FEED_BLOCK_ID=R-A-19849293-1
```

Отдельные блоки можно указать позже, если в РСЯ нужно разделить статистику по страницам:

```env
NEXT_PUBLIC_YANDEX_RSYA_HUNT_FEED_BLOCK_ID=
NEXT_PUBLIC_YANDEX_RSYA_PUBLIC_HUNT_FEED_BLOCK_ID=
NEXT_PUBLIC_YANDEX_RSYA_PARTNERS_FEED_BLOCK_ID=
NEXT_PUBLIC_YANDEX_RSYA_MARKETPLACE_FEED_BLOCK_ID=
NEXT_PUBLIC_YANDEX_RSYA_HUNT_SHOP_BANNER_BLOCK_ID=R-A-19849293-2
NEXT_PUBLIC_YANDEX_RSYA_COMPANY_GO_BLOCK_ID=
```

Если отдельный block id не задан, страница использует `NEXT_PUBLIC_YANDEX_RSYA_APP_FEED_BLOCK_ID`.
Для бесплатных компаний Nearloy GO используется `NEXT_PUBLIC_YANDEX_RSYA_COMPANY_GO_BLOCK_ID`; если он пустой, берётся общий app feed-блок.

На localhost fallback-заглушка не скрывается автоматически, чтобы блоки рекламы были видны при разработке. В production пустой fallback скрывается, если РСЯ не отрендерила iframe.

Для локальной разработки и тестовых окружений:

```env
NEXT_PUBLIC_YANDEX_RSYA_ENABLED=false
```

## Текущие размещения

Реклама добавлена только в места, где она не мешает основному действию:

- `/hunt` - между постами Hunt после третьего поста, дальше через несколько постов.
- `/hunt/public` - между публичными постами открытой ленты.
- `/app` - один блок после баланса, перед остальным контентом.
- `/companies` - между карточками партнёров после нескольких элементов.
- `/marketplace` - между подписками, только когда marketplace подписок включён.

## Где не показываем

Пока намеренно не добавляем рекламу:

- создание Hunt-поста;
- попап открытия коробки;
- попап улучшения карточки;
- страница боя;
- QR-экран;
- формы входа, регистрации, оплаты и настроек.

В этих местах реклама будет мешать конверсии или игровому действию.

## Railway

На Web service Railway нужно выставить:

```env
NEXT_PUBLIC_YANDEX_RSYA_ENABLED=true
NEXT_PUBLIC_YANDEX_RSYA_APP_FEED_BLOCK_ID=R-A-19849293-1
NEXT_PUBLIC_YANDEX_RSYA_HUNT_SHOP_BANNER_BLOCK_ID=R-A-19849293-2
```

После изменения `NEXT_PUBLIC_*` переменных нужен новый deploy Web service, потому что Next.js встраивает эти значения во фронтенд на этапе сборки.
