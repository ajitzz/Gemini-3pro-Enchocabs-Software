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

async function testDuplicates(count) {
  console.log(`Starting duplicate test for ${count} identical daily entries...`);
  const promises = [];
  const data = {
    date: '2026-02-01',
    driver: 'TestDuplicateDriver',
    vehicle: 'DUP-123',
    rent: 500,
    collection: 1000
  };
  
  for (let i = 0; i < count; i++) {
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

async function testWeeklyWallets(count) {
  console.log(`Starting concurrency test for ${count} weekly wallets...`);
  const promises = [];
  
  for (let i = 0; i < count; i++) {
    const data = {
      weekStartDate: '2026-02-02', // Monday
      driver: `TestWalletDriver_${i}`, // distinct driver per wallet to test connection pool
      earnings: 5000,
      cash: 1000
    };
    promises.push(makeRequest('/api/weekly-wallets', data));
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
  await testDuplicates(20);
  await delay(1000);
  await testWeeklyWallets(50);
}
main().catch(console.error);
