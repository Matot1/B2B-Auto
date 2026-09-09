# B2B-Auto

**Стек:** Playwright + Node.js  
**Сайт:** `b2b.fstravel.com` / `.by` / `.asia`

Канон — этот репозиторий. Источник: MacBook.

## Основные тесты

| Файл | Сайт | Откуда | Куда | Что бронирует |
|---|---|---|---|---|
| `b2bVietnamBron.js` | `b2b.fstravel.com/search_tour` | Москва | Вьетнам, `Vietnam MOW-CXR AZUR new` | статика |
| `b2bEgyptBron.js` | `b2b.fstravel.com/search_tour` | Москва | Египет, тур с `Sharm` | чартер/блок |
| `b2bGDSBron.js` | `b2b.fstravel.com/search_tour` | Москва | Турция, `Turkey Alanya MOW GDS (GZP)` | GDS |
| `b2bHotelBron.js` | `b2b.fstravel.com/search_hotel` | — | Кипр, `Cyprus (hotel only)` | только отель |
| `b2bCharterBY.js` | `b2b.fstravel.by/search_tour` | Минск | Египет | чартер, первый тур по цене |
| `b2bCharterAsia.js` | `b2b.fstravel.asia/search_tour` | Астана | Египет | чартер/блок, первый тур по цене |
| `b2bConstruct.js` | `b2b.fstravel.com/cl_wizard` | Москва | Египет, `SL TOUR Hurghada MOW` | конструктор: гостиница + транспорт. **ещё доделывается** |

## Запуск

См. `run.md`.

## `notify.cjs`

Отправка в Mattermost через `MATTERMOST_WEBHOOK`. Сейчас не подключена к скриптам, включим позже.

## `.env`

```
LOGIN=ваш_логин
PASSWORD=ваш_пароль
MATTERMOST_WEBHOOK=https://mattermost.yourcompany.com/hooks/xxx
```
