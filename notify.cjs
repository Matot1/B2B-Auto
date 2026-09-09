const https = require('https');

function sendMattermost(message) {
  return new Promise((resolve) => {
    const webhookUrl = process.env.MATTERMOST_WEBHOOK;

    if (!webhookUrl) {
      console.error('MATTERMOST_WEBHOOK не задан в .env');
      resolve();
      return;
    }

    const data = JSON.stringify({ text: message });
    const url = new URL(webhookUrl);

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
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
            console.log('Уведомление отправлено в Mattermost');
          } else {
            console.error('Ошибка Mattermost:', res.statusCode, body);
          }
          resolve();
        });
      }
    );

    req.on('error', (err) => {
      console.error('Ошибка отправки в Mattermost:', err.message);
      resolve();
    });
    req.write(data);
    req.end();
  });
}

module.exports = { sendMattermost };
