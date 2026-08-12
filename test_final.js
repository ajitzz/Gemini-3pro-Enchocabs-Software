require('dotenv').config();
const { pool } = require('./server/db');
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

async function run() {
  console.log("Truncating tables...");
  await pool.query('TRUNCATE TABLE daily_entries, weekly_wallets, driver_billings CASCADE;');
  
  console.log("Testing 100 concurrent daily entries (3 unique drivers)...");
  let promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(makeRequest('/api/daily-entries', {
      date: '2026-03-05', driver: `Driver_${i % 3}`, collection: 1000, shift: 'day'
    }));
  }
  let results = await Promise.all(promises);
  console.log(`Daily Success: ${results.filter(r => r.status === 200).length}, Conflict: ${results.filter(r => r.status === 409).length}, Error: ${results.filter(r => r.status === 500).length}`);

  console.log("Testing 100 concurrent weekly wallets (3 unique drivers)...");
  promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(makeRequest('/api/weekly-wallets', {
      weekStartDate: '2026-03-02', driver: `Driver_${i % 3}`, earnings: 5000
    }));
  }
  results = await Promise.all(promises);
  console.log(`Weekly Success: ${results.filter(r => r.status === 200).length}, Conflict: ${results.filter(r => r.status === 409).length}, Error: ${results.filter(r => r.status === 500).length}`);

  console.log("Verifying Database State...");
  const dCount = await pool.query('SELECT count(*) FROM daily_entries');
  const wCount = await pool.query('SELECT count(*) FROM weekly_wallets');
  const bCount = await pool.query('SELECT count(*) FROM driver_billings');
  console.log(`Total Rows -> Daily: ${dCount.rows[0].count}, Weekly: ${wCount.rows[0].count}, Billings: ${bCount.rows[0].count}`);

  const dDup = await pool.query('SELECT count(*) FROM (SELECT driver, date FROM daily_entries GROUP BY driver, date HAVING COUNT(*) > 1) AS sub');
  const wDup = await pool.query('SELECT count(*) FROM (SELECT driver, week_start_date FROM weekly_wallets GROUP BY driver, week_start_date HAVING COUNT(*) > 1) AS sub');
  const bDup = await pool.query('SELECT count(*) FROM (SELECT driver_name, week_start_date FROM driver_billings GROUP BY driver_name, week_start_date HAVING COUNT(*) > 1) AS sub');
  console.log(`Duplicates -> Daily: ${dDup.rows[0].count}, Weekly: ${wDup.rows[0].count}, Billings: ${bDup.rows[0].count}`);

  pool.end();
}
run().catch(console.error);
