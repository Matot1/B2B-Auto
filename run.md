# Запуск автотестов

```bash
npm install
npx playwright install chromium
```

Каждый скрипт — отдельно:

```bash
node b2bVietnamBron.js
node b2bEgyptBron.js
node b2bGDSBron.js
node b2bHotelBron.js
node b2bCharterBY.js
node b2bCharterAsia.js
node b2bConstruct.js
```

`b2bConstruct.js` ещё доделывается.

Фильтры и логин (не бронируют):

```bash
npx playwright test
```
