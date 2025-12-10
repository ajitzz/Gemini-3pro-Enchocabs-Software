
const { Pool } = require('pg');

// Vercel Postgres uses 'POSTGRES_URL', generic hosts use 'DATABASE_URL'
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (process.env.NODE_ENV === 'production' && !connectionString) {
  console.error("CRITICAL ERROR: No database connection string found. Please connect Vercel Postgres in the Storage tab.");
}

const pool = new Pool({
  connectionString: connectionString || 'postgresql://postgres:password@localhost:5432/encho_cabs',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.connect()
  .then(() => console.log('Successfully connected to PostgreSQL database'))
  .catch(err => {
    console.error('Failed to connect to PostgreSQL.', err.message);
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
