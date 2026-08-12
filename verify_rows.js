require('dotenv').config();
const { pool } = require('./server/db');
async function checkRows() {
  const res1 = await pool.query('SELECT count(*) FROM daily_entries');
  console.log(`Total daily_entries: ${res1.rows[0].count}`);
  const res2 = await pool.query('SELECT count(*) FROM weekly_wallets');
  console.log(`Total weekly_wallets: ${res2.rows[0].count}`);
  const res3 = await pool.query(`SELECT driver, date, COUNT(*) FROM daily_entries GROUP BY driver, date HAVING COUNT(*) > 1`);
  console.log(`Duplicate daily_entries: ${res3.rows.length}`);
  const res4 = await pool.query(`SELECT driver_name, week_start_date, COUNT(*) FROM driver_billings GROUP BY driver_name, week_start_date HAVING COUNT(*) > 1`);
  console.log(`Duplicate driver_billings: ${res4.rows.length}`);
  pool.end();
}
checkRows().catch(console.error);
