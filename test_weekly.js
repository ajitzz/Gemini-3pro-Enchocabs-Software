const http = require('http');
const makeRequest = (endpoint, data) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1', port: 3001, path: endpoint, method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
};
async function runTest(count, driverPrefix) {
  console.log(`Starting concurrency test for ${count} weekly wallets...`);
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(makeRequest('/api/weekly-wallets', {
      weekStartDate: '2026-03-02', driver: `${driverPrefix}_${i % 3}`, earnings: 5000, cash: 1000
    }));
  }
  const start = Date.now();
  const results = await Promise.all(promises);
  const end = Date.now();
  const successCount = results.filter(r => r.status === 200).length;
  const conflictCount = results.filter(r => r.status === 409).length;
  const errorCount = results.filter(r => r.status === 500).length;
  console.log(`Completed in ${end - start}ms`);
  console.log(`Success: ${successCount}, Conflict: ${conflictCount}, Error: ${errorCount}`);
  if (errorCount > 0) console.log(results.filter(r => r.status === 500));
}
runTest(100, 'TestDriver_100').catch(console.error);
