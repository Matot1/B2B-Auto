# B2B-Auto

**Стек:** Playwright + Node.js  
**Сайт:** `b2b.fstravel.com` / `.by` / `.asia`

Канон — этот репозиторий. Источник: MacBook.

## Основные тесты

| Файл | Сайт | Откуда | Куда | Что бронирует |
|---|---|---|---|---|
| `b2bEgyptBron.spec.js` | `b2b.fstravel.com/search_tour` | Москва | Египет, тур с `Sharm` | чартер/блок |
| `b2bGDSBron.spec.js` | `b2b.fstravel.com/search_tour` | Москва | Турция, `Turkey Antalya MOW GDS*` | GDS, 1 взрослый |
| `b2bHotelBron.spec.js` | `b2b.fstravel.com/search_hotel` | — | Таиланд, продукт «Статика», программа «Стандарт» | только отель |
| `b2bCharterBY.spec.js` | `b2b.fstravel.by/search_tour` | Минск | Египет | чартер, ночей от 7 или 11, первый тур по цене |
| `b2bCharterAsia.spec.js` | `b2b.fstravel.asia/search_tour` | Астана | Египет, группа «Чартер/блочная перевозка» | чартер/блок, первый тур по цене |
| `b2bConstruct.spec.js` | `b2b.fstravel.com/cl_wizard` | Москва | Египет, `SL TOUR Hurghada MOW`, прилёт Хургада | конструктор: гостиница + транспорт |

## Запуск

Все брони:

```bash
npm run test:prod
```

Окно браузера: `HEADED=1 npm run test:prod`.

Один тест:

```bash
npx playwright test --config=playwright.bron.config.js b2bEgyptBron.spec.js
```

## `notify.cjs`

Отправка в Band через `BAND_WEBHOOK` или `MATTERMOST_WEBHOOK`. Подключено ко всем `b2b*.spec.js`: успех и ошибка.

## `.env`

```
LOGIN=ваш_логин
PASSWORD=ваш_пароль
BAND_WEBHOOK=https://your-band-or-mattermost/hooks/xxx
BASE_URL=https://b2b.fstravel.com
BASE_URL_BY=https://b2b.fstravel.by
BASE_URL_ASIA=https://b2b.fstravel.asia
```
