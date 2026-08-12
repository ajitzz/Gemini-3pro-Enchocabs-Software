const http = require('http');
const req = http.request({
  hostname: '127.0.0.1', port: 3001, path: '/api/daily-entries', method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});
req.write(JSON.stringify({ date: '2026-03-05', driver: `Driver_0`, collection: 1000, shift: 'day' }));
req.end();
