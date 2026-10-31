
require('dotenv').config();
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

const isSslRequired = Boolean(
  process.env.NODE_ENV === 'production' ||
  (connectionString && (
    connectionString.includes('sslmode=require') ||
    connectionString.includes('sslmode=verify') ||
    connectionString.includes('.neon.tech') ||
    connectionString.includes('aws.') ||
    connectionString.includes('ssl=true')
  ))
);

const pool = new Pool({
  connectionString: connectionString || 'postgresql://postgres:password@127.0.0.1:5432/encho_cabs',
  ssl: isSslRequired ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  maxUses: 7500,
  keepAlive: true,
  allowExitOnIdle: false
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

const { executeFallbackQuery } = require('./local_db');

let isConnectedToPostgres = false;

pool.connect()
  .then((client) => {
    isConnectedToPostgres = true;
    console.log('Successfully connected to PostgreSQL database');
    client.release();
  })
  .catch(err => {
    isConnectedToPostgres = false;
    console.warn('[Database Fallback] PostgreSQL connection unavailable (' + err.message + '). Activating resilient local database store.');
  });

const safeQuery = async (text, params) => {
  if (isConnectedToPostgres) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === '28P01' || err.code === 'ETIMEDOUT') {
        isConnectedToPostgres = false;
        console.warn('[Database Fallback] Query routing to local store due to connection error:', err.message);
        return executeFallbackQuery(text, params);
      }
      throw err;
    }
  }
  return executeFallbackQuery(text, params);
};

const resilientPool = {
  ...pool,
  query: safeQuery,
  connect: async () => {
    if (isConnectedToPostgres) {
      try {
        const client = await pool.connect();
        return client;
      } catch (err) {
        isConnectedToPostgres = false;
      }
    }
    return {
      query: (text, params) => executeFallbackQuery(text, params),
      release: () => {}
    };
  }
};

module.exports = {
  query: safeQuery,
  pool: resilientPool
};
