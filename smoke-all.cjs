require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { sendMattermost } = require('./notify.cjs');

const RESULTS_FILE = path.join(__dirname, 'smoke-results.json');

const specs = [
  'b2bCharterRU.spec.js',
  'b2bGDSBron.spec.js',
  'b2bHotelBron.spec.js',
  'b2bConstruct.spec.js',
  'b2bCharterBY.spec.js',
  'b2bCharterAsia.spec.js',
];

function claimOf(results, name) {
  const row = results[name];
  if (row && row.ok && row.orderNumber && row.orderNumber !== 'не найден') {
    return row.orderNumber;
  }
  const error = String((row && row.error) || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (error) {
    return row.step ? `${row.step}: ${error}` : error;
  }
  return '—';
}

fs.writeFileSync(RESULTS_FILE, '{}');

for (const spec of specs) {
  console.log(`\n=== ${spec} ===\n`);
  const run = spawnSync(
    'npx',
    ['playwright', 'test', '--config=playwright.bron.config.js', spec],
    {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env, SMOKE_BATCH: '1' },
    },
  );
  if (run.status !== 0) {
    console.error(`${spec} завершился с кодом ${run.status}`);
  }
}

let results = {};
try {
  results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
} catch (_) {}

const text = [
  'Локаль .com',
  '```',
  `Чартер - ${claimOf(results, 'Egypt')}`,
  `GDS - ${claimOf(results, 'GDS')}`,
  `Отель - ${claimOf(results, 'Hotel')}`,
  `Конструктор - ${claimOf(results, 'Construct')}`,
  '```',
  'Локаль .by',
  '```',
  `Чартер - ${claimOf(results, 'CharterBY')}`,
  '```',
  'Локаль .asia',
  '```',
  `Чартер - ${claimOf(results, 'CharterAsia')}`,
  '```',
].join('\n');

console.log('\n' + text + '\n');
sendMattermost(text).then(() => {
  process.exit(0);
});
