require('dotenv').config();
const { pool } = require('./server/db');
pool.query('SELECT 1').then(console.log).catch(console.error).finally(() => pool.end());
