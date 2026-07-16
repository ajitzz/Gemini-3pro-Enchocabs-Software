const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/manager-access',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(JSON.stringify({
  managerId: '48b6c59d-d6c4-4b55-a0fb-33433519842c',
  childDriverIds: ['800a740f-71ad-4672-bef0-4f59048aebce']
}));
req.end();
