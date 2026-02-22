<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1uujoGkL20G_JOEUoqiymNNDgzPNwgcWv

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Redis configuration

If you enable caching, set `REDIS_URL` (or `UPSTASH_REDIS_URL`) to the raw connection string, **not** a `redis-cli -u ...` command. Managed Redis providers such as Redis Cloud/RedisLabs typically require TLS; use a `rediss://` URL for those hosts. Example: `REDIS_URL=rediss://default:<password>@<host>:<port>`. On Vercel, add this exact `rediss://` value as a project environment variable so the server connects over TLS.

## API base URL for hosted frontends

If your frontend is deployed on a different host than the Express API (for example, preview deployments), set `VITE_API_URL` (or legacy alias `VITE_API_BASE_URL`) to your backend origin.

Examples:

- `VITE_API_URL=https://api.example.com`
- `VITE_API_URL=https://api.example.com/api`

The client normalizes both forms to `<origin>/api` and supports both `VITE_API_URL` and `VITE_API_BASE_URL` env names.

If this is unset, browsers call same-origin `/api/...`. If your current host only serves the SPA, API requests will return HTML/404 instead of JSON.

### Session + bot config cache (Upstash Redis)

The API caches authenticated session payloads and bot configuration in Redis to reduce round trips under load. Configure TTLs with:

- `SESSION_CACHE_TTL_SECONDS` (default: 6 hours)
- `BOT_CONFIG_CACHE_TTL_SECONDS` (default: 10 minutes)
- `BOT_CONFIG_JSON` (optional JSON string used as a fallback when the cache is empty)

### Throttle control (Upstash QStash)

To offload heavy billing refresh work, you can enqueue refresh jobs in QStash:

- `QSTASH_TOKEN` (or `UPSTASH_QSTASH_TOKEN`) - required to publish.
- `QSTASH_DRIVER_BILLINGS_REFRESH_URL` - public URL for `POST /api/driver-billings/refresh`.
- `QSTASH_REFRESH_TOKEN` - optional shared secret sent as `X-Refresh-Token` to protect the refresh endpoint.
- `QSTASH_REFRESH_DEDUPLICATION_ID` - optional deduplication key (default: `driver-billings-refresh`).

## Keep the Render service warm (optional)

If you are deploying to Render's free tier and want to reduce cold-start delays, set a `KEEP_ALIVE_URL` environment variable to the deployed URL you want pinged (for example, `https://<your-app>.onrender.com/health`). The server will ping this URL on startup and then every 14 minutes by default (configure with `KEEP_ALIVE_INTERVAL_MINUTES`).

## Production health monitoring

The API exposes lightweight health endpoints at both `/health` and `/api/health` (same response: `200` + `{ status: 'ok' }`) from both the Edge worker and the Express server. To monitor uptime without adding load:

1. In UptimeRobot, create an HTTP(s) monitor pointed to `<your-domain>/health`. Both `GET` and `HEAD` respond with `200` and `{ status: 'ok' }`, and they set `Cache-Control: no-store` so you always hit live code.
2. Set the interval to 5 minutes so the check stays snappy while keeping free-tier allowances in mind.
3. (Optional) Keep the existing `KEEP_ALIVE_URL` pointing at the same `/health` URL if you want Render dynos to stay warm in addition to external monitoring.

This approach keeps checks fast and side-effect free while giving you early warning if deployments go down.

## Driver billing refresh behavior

The `GET /api/driver-billings` endpoint now serves cached results immediately and only performs a full recomputation when explicitly requested. If you need to refresh billings on-demand, call the endpoint with `?refresh=true` or set `SYNC_BILLINGS_ON_READ=true` in the server environment to enable recomputation on cache misses. This prevents expensive billing syncs from slowing down every page load while still allowing manual refreshes when needed.
