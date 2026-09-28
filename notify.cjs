const fs = require('fs');
const path = require('path');
const https = require('https');

const RESULTS_FILE = path.join(__dirname, 'smoke-results.json');

function postOnce(webhookUrl, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        family: 4,
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`${res.statusCode} ${body}`));
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function sendMattermost(message) {
  const webhookUrl = process.env.BAND_WEBHOOK || process.env.MATTERMOST_WEBHOOK;

  if (!webhookUrl) {
    console.error('BAND_WEBHOOK / MATTERMOST_WEBHOOK не задан в .env');
    return;
  }

  const data = JSON.stringify({ text: message });
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await postOnce(webhookUrl, data);
      console.log('Уведомление отправлено в Band');
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.error('Ошибка отправки в Band:', lastErr.message);
}

async function notifyBron({ name, ok, orderNumber, claimUrl, step, error, url, priceNote }) {
  if (process.env.SMOKE_BATCH === '1') {
    let data = {};
    try {
      data = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
    } catch (_) {}
    data[name] = {
      ok,
      orderNumber: orderNumber || '',
      step: step || '',
      error: error || '',
      priceNote: priceNote || '',
    };
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2));
    return;
  }

  const lines = ok
    ? [`✅ ${name}: бронь ок`, orderNumber ? `Заявка: ${orderNumber}` : null, priceNote || null, claimUrl || null]
    : [`❌ ${name}: ошибка`, step ? `Шаг: ${step}` : null, error || null, url || null];
  await sendMattermost(lines.filter(Boolean).join('\n'));
}

module.exports = { sendMattermost, notifyBron };
