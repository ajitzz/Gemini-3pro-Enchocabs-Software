const http = require('http');

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const makeRequest = (endpoint, data) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
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

async function runTest(count, driverPrefix) {
  console.log(`Starting concurrency test for ${count} daily entries...`);
  const promises = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(2026, 0, 1 + i);
    const isoDate = date.toISOString().slice(0, 10);
    const data = {
      date: isoDate,
      driver: `${driverPrefix}_${i % 3}`, // spread across 3 drivers
      vehicle: 'TEST-123',
      rent: 500,
      collection: 1000
    };
    promises.push(makeRequest('/api/daily-entries', data));
  }
  
  const start = Date.now();
  const results = await Promise.all(promises);
  const end = Date.now();
  
  const successCount = results.filter(r => r.status === 200).length;
  const conflictCount = results.filter(r => r.status === 409).length;
  const errorCount = results.filter(r => r.status === 500).length;
  
  console.log(`Completed in ${end - start}ms`);
  console.log(`Success: ${successCount}, Conflict: ${conflictCount}, Error: ${errorCount}`);
  if (errorCount > 0) {
    console.log(results.filter(r => r.status === 500));
  }
}

async function main() {
  await runTest(10, 'Driver_10');
  await delay(1000);
  await runTest(20, 'Driver_20');
  await delay(1000);
  await runTest(50, 'Driver_50');
}
main().catch(console.error);
