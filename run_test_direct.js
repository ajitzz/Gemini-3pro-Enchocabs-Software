require('dotenv').config();
const { pool } = require('./server/db');

async function test() {
  try {
    const res = await pool.query("SELECT 1 as val");
    console.log("Connected:", res.rows[0].val);
  } catch (err) {
    console.error("DB Error:", err);
  }
}
test();
