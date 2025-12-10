
const { Pool } = require('pg');

// Basic check to see if we are in production but missing config
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  console.error("CRITICAL ERROR: DATABASE_URL environment variable is not set. Database connection will fail.");
}

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
  .catch(err => {
    console.error('Failed to connect to PostgreSQL.', err.message);
    if (process.env.NODE_ENV === 'production') {
        console.error('HINT: Did you add the DATABASE_URL environment variable in your Vercel project settings?');
    }
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
