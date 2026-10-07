# B2B-Auto

**Стек:** Playwright + Node.js  
**Сайт:** `b2b.fstravel.com` / `.by` / `.asia`

Канон — этот репозиторий. Источник: MacBook.

## Основные тесты


| Файл                     | Сайт                            | Откуда | Куда                                            | Что бронирует                                 |
| ------------------------ | ------------------------------- | ------ | ----------------------------------------------- | --------------------------------------------- |
| `b2bCharterRU.spec.js`   | `b2b.fstravel.com/search_tour`  | Москва | Таиланд, группа «Чартер/блочная перевозка»      | чартер/блок                                   |
| `b2bGDSBron.spec.js`     | `b2b.fstravel.com/search_tour`  | Москва | Турция, `Turkey Antalya MOW GDS*`               | GDS, 1 взрослый                               |
| `b2bHotelBron.spec.js`   | `b2b.fstravel.com/search_hotel` | —      | Турция, продукт «Статика», программа «Стандарт» | только отель                                  |
| `b2bCharterBY.spec.js`   | `b2b.fstravel.by/search_tour`   | Минск  | Таиланд, `Thailand Phuket MSQ`, четверг или воскресенье | чартер, ночей от 7 или 11, первый тур по цене |
| `b2bCharterAsia.spec.js` | `b2b.fstravel.asia/search_tour` | Астана | Египет, группа «Чартер/блочная перевозка»       | чартер/блок, первый тур по цене               |
| `b2bConstruct.spec.js`   | `b2b.fstravel.com/cl_wizard`    | Москва | Турция, `SL TOUR Antalya MOW`                   | конструктор: гостиница + транспорт            |


## Запуск

Все брони:

```bash
npm run test:prod
```

Окно браузера: `HEADED=1 npm run test:prod`.

Один тест:

```bash
npx playwright test --config=playwright.bron.config.js b2bCharterRU.spec.js
```

## `notify.cjs`

Отдельный тест шлёт отчёт в `BAND_WEBHOOK` (или `MATTERMOST_WEBHOOK`).

## `.env`

```
LOGIN=ваш_логин
PASSWORD=ваш_пароль
BAND_WEBHOOK=https://your-band-or-mattermost/hooks/xxx
BASE_URL=https://b2b.fstravel.com
BASE_URL_BY=https://b2b.fstravel.by
BASE_URL_ASIA=https://b2b.fstravel.asia
```

