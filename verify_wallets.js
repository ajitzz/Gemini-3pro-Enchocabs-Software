require('dotenv').config();
const { pool } = require('./server/db');
async function checkRows() {
  const res3 = await pool.query(`SELECT driver, week_start_date, COUNT(*) FROM weekly_wallets GROUP BY driver, week_start_date HAVING COUNT(*) > 1`);
  console.log(`Duplicate weekly_wallets: ${res3.rows.length}`);
  pool.end();
}
checkRows().catch(console.error);
