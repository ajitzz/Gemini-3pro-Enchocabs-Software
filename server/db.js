
const { Pool } = require('pg');

// Vercel Postgres uses 'POSTGRES_URL', generic hosts use 'DATABASE_URL'
const rawConnectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

const normalizeConnectionString = (value) => {
  if (!value) return value;
  try {
    const parsed = new URL(value);
    const sslMode = (parsed.searchParams.get('sslmode') || '').toLowerCase();
    const needsCompat =
      (sslMode === 'prefer' || sslMode === 'require' || sslMode === 'verify-ca')
      && !parsed.searchParams.has('useLibpqCompat');

    if (needsCompat) {
      parsed.searchParams.set('useLibpqCompat', 'true');
      return parsed.toString();
    }
    return value;
  } catch (_error) {
    return value;
  }
};

const connectionString = normalizeConnectionString(rawConnectionString);
if (rawConnectionString && connectionString !== rawConnectionString) {
  console.log('Normalized PostgreSQL connection string for libpq SSL compatibility.');
}

if (process.env.NODE_ENV === 'production' && !connectionString) {
  console.error("CRITICAL ERROR: No database connection string found. Please connect Vercel Postgres in the Storage tab.");
}

const pool = new Pool({
  connectionString: connectionString || 'postgresql://postgres:password@127.0.0.1:5432/encho_cabs',
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
