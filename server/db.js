
require('dotenv').config();
const { Pool } = require('pg');

// Vercel Postgres uses several env keys; try pooling connection first then fallbacks
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (process.env.NODE_ENV === 'production' && !connectionString) {
  console.error("CRITICAL ERROR: No database connection string found. Please connect Vercel Postgres in the Storage tab.");
}

const connectionDebug = (() => {
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch (_err) {
    return 'unavailable';
  }
})();

const pool = new Pool({
  connectionString: connectionString || 'postgresql://postgres:password@localhost:5432/encho_cabs',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.connect()
  .then(() => console.log('Successfully connected to PostgreSQL database', connectionDebug === 'unavailable' ? '' : `(${connectionDebug})`))
  .catch(err => {
    console.error('Failed to connect to PostgreSQL.', err.message);
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
