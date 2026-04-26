const { Client } = require('@upstash/qstash');

const qstashToken = (process.env.QSTASH_TOKEN || process.env.UPSTASH_QSTASH_TOKEN || '').trim();
const qstashBaseUrl = (process.env.QSTASH_BASE_URL || process.env.UPSTASH_QSTASH_URL || '').trim() || undefined;
const refreshUrl = (process.env.QSTASH_DRIVER_BILLINGS_REFRESH_URL || '').trim();
const refreshToken = (process.env.QSTASH_REFRESH_TOKEN || '').trim();
const refreshDeduplicationId = (process.env.QSTASH_REFRESH_DEDUPLICATION_ID || 'driver-billings-refresh').trim();

const client = qstashToken
  ? new Client({ token: qstashToken, baseUrl: qstashBaseUrl })
  : null;

const isQStashConfigured = () => !!client && !!refreshUrl;

const enqueueBillingRefresh = async () => {
  if (!isQStashConfigured()) {
    return { queued: false, reason: 'QStash not configured' };
  }

  const headers = {};
  if (refreshToken) {
    headers['X-Refresh-Token'] = refreshToken;
  }

  await client.publishJSON({
    url: refreshUrl,
    body: { source: 'api', requestedAt: new Date().toISOString() },
    headers,
    deduplicationId: refreshDeduplicationId,
  });

  return { queued: true };
};

module.exports = {
  enqueueBillingRefresh,
  isQStashConfigured,
};
