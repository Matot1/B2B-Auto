const https = require('https');

function sendMattermost(message) {
  return new Promise((resolve) => {
    const webhookUrl = process.env.BAND_WEBHOOK || process.env.MATTERMOST_WEBHOOK;

    if (!webhookUrl) {
      console.error('BAND_WEBHOOK / MATTERMOST_WEBHOOK не задан в .env');
      resolve();
      return;
    }

    const data = JSON.stringify({ text: message });
    const url = new URL(webhookUrl);

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('Уведомление отправлено в Band');
          } else {
            console.error('Ошибка Band:', res.statusCode, body);
          }
          resolve();
        });
      }
    );

    req.on('error', (err) => {
      console.error('Ошибка отправки в Band:', err.message);
      resolve();
    });
    req.write(data);
    req.end();
  });
}

async function notifyBron({ name, ok, orderNumber, claimUrl, step, error, url }) {
  const lines = ok
    ? [`✅ ${name}: бронь ок`, orderNumber ? `Заявка: ${orderNumber}` : null, claimUrl || null]
    : [`❌ ${name}: ошибка`, step ? `Шаг: ${step}` : null, error || null, url || null];
  await sendMattermost(lines.filter(Boolean).join('\n'));
}

module.exports = { sendMattermost, notifyBron };
