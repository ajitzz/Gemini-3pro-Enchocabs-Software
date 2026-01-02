const { createClient } = require('redis');

const redisUrlRaw = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || process.env.REDIS_TLS_URL;
let redisUrl = redisUrlRaw;

// Support accidental "redis-cli -u <url>" style values in REDIS_URL to avoid silent failures.
if (redisUrlRaw && redisUrlRaw.includes('redis-cli')) {
  const maybeUrl = redisUrlRaw
    .split(/\s+/)
    .find((token) => token.startsWith('redis://') || token.startsWith('rediss://'));

  if (maybeUrl) {
    console.warn('REDIS_URL appears to include a redis-cli command; using extracted URL token.');
    redisUrl = maybeUrl;
  } else {
    console.error('REDIS_URL looks like a redis-cli command without a redis:// URL. Redis cache disabled.');
    redisUrl = null;
  }
}
let client = null;
let connectPromise = null;

if (redisUrl) {
  client = createClient({
    url: redisUrl,
    socket: {
      tls: redisUrl.startsWith('rediss://'),
      rejectUnauthorized: false,
    },
  });

  client.on('error', (err) => {
    console.error('Redis client error:', err.message || err);
  });

  connectPromise = client.connect()
    .then(() => console.log('Redis cache connected'))
    .catch((err) => {
      console.error('Redis connection failed, caching disabled:', err.message || err);
      client = null;
    });
} else {
  console.log('Redis cache disabled (set REDIS_URL or UPSTASH_REDIS_URL to enable).');
}

const ensureClient = async () => {
  if (!client) return null;
  if (connectPromise) await connectPromise;
  return client;
};

const getJSON = async (key) => {
  const activeClient = await ensureClient();
  if (!activeClient) return null;
  const raw = await activeClient.get(key);
  return raw ? JSON.parse(raw) : null;
};

const setJSON = async (key, value, ttlSeconds = 0) => {
  const activeClient = await ensureClient();
  if (!activeClient) return;
  const serialized = JSON.stringify(value);
  if (ttlSeconds > 0) {
    await activeClient.setEx(key, ttlSeconds, serialized);
  } else {
    await activeClient.set(key, serialized);
  }
};

const deleteKeys = async (keys = []) => {
  const activeClient = await ensureClient();
  if (!activeClient || keys.length === 0) return;
  await activeClient.del(keys);
};

module.exports = {
  getJSON,
  setJSON,
  deleteKeys,
};
