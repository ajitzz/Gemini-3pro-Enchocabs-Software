const https = require('https');

const makeRequest = (endpoint, data) => {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'ais-dev-6uwzwcn2bhnwikvxenr63d-161944764333.asia-southeast1.run.app',
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
};

async function testDuplicates() {
  const data = {
    date: '2026-03-01',
    driver: 'TestDuplicateCloud',
    vehicle: 'CLOUD-123',
    rent: 500,
    collection: 1000
  };
  const res = await makeRequest('/api/daily-entries', data);
  console.log(res);
}

testDuplicates();
