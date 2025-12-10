
const { Pool } = require('pg');

// Use environment variables for connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/encho_cabs',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Simple logging to debug connection state
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.connect()
  .then(() => console.log('Successfully connected to PostgreSQL database'))
  .catch(err => console.error('Failed to connect to PostgreSQL. Check your credentials and if DB is running.', err.message));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
