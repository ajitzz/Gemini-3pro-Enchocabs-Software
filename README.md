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


## Frontend API base URL (Vercel)

## Google OAuth client-id configuration

Set one of these in frontend env:

- `VITE_GOOGLE_CLIENT_ID` - single client id used on every host.
- `VITE_GOOGLE_CLIENT_ID_MAP` - JSON map of host/origin to client id (recommended when using multiple domains), e.g. `{"https://portal.enchocabs.com":"...apps.googleusercontent.com","localhost:5173":"...apps.googleusercontent.com","enchocabs.com":"...apps.googleusercontent.com"}`.
  - Keys may be full origins, `host:port`, plain hostnames, or parent domains (for subdomain fallback).
  - Avoid adding paths in map keys (`/staff`, trailing `/`). Use host/origin only.

### Fix for `[GSI_LOGGER]: The given origin is not allowed for the given client ID`

If Google login suddenly fails on Vercel previews or new domains, it is usually an OAuth origin mismatch. Ensure all of the following:

1. In Google Cloud Console → OAuth Client, add every frontend domain to **Authorized JavaScript origins** (no path), for example:
   - `https://gemini-3pro-enchocabs-software.vercel.app`
   - `https://your-production-domain.com`
   - `http://localhost:5173`
2. In frontend env, map each host to the matching client id:
   - `VITE_GOOGLE_CLIENT_ID_MAP={"gemini-3pro-enchocabs-software.vercel.app":"<client-id>","your-production-domain.com":"<client-id>","localhost:5173":"<client-id>"}`
3. In backend env, allow all audiences that can issue ID tokens:
   - `GOOGLE_CLIENT_IDS=<client-id-1>,<client-id-2>`
4. Redeploy frontend and backend after env changes.

Backend/worker token verification can accept multiple audiences with:

- `GOOGLE_CLIENT_IDS` - comma-separated list of allowed OAuth client IDs.

This prevents login failures when different environments (localhost, preview, production) use different Google OAuth client IDs.

Set `VITE_API_URL` in your frontend deployment environment:

- Recommended: `https://<your-backend>.onrender.com/api`
- Also accepted by the app: `<your-backend>.onrender.com/api` (the client auto-adds `https://`)
- Local/dev proxy: `/api`

If this value is malformed, browsers can throw SSL/network errors when loading data. After updating env vars in Vercel, trigger a fresh redeploy.

## Redis configuration

If you enable caching, set `REDIS_URL` (or `UPSTASH_REDIS_URL`) to the raw connection string, **not** a `redis-cli -u ...` command. Managed Redis providers such as Redis Cloud/RedisLabs typically require TLS; use a `rediss://` URL for those hosts. Example: `REDIS_URL=rediss://default:<password>@<host>:<port>`. On Vercel, add this exact `rediss://` value as a project environment variable so the server connects over TLS.

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

The API already exposes a lightweight `/health` endpoint that responds with `200` and `{ status: 'ok' }` from both the Edge worker and the Express server. To monitor uptime without adding load:

1. In UptimeRobot, create an HTTP(s) monitor pointed to `<your-domain>/health`. Both `GET` and `HEAD` respond with `200` and `{ status: 'ok' }`, and they set `Cache-Control: no-store` so you always hit live code.
2. Set the interval to 5 minutes so the check stays snappy while keeping free-tier allowances in mind.
3. (Optional) Keep the existing `KEEP_ALIVE_URL` pointing at the same `/health` URL if you want Render dynos to stay warm in addition to external monitoring.

This approach keeps checks fast and side-effect free while giving you early warning if deployments go down.

## Driver billing refresh behavior

The `GET /api/driver-billings` endpoint now serves cached results immediately and only performs a full recomputation when explicitly requested. If you need to refresh billings on-demand, call the endpoint with `?refresh=true` or set `SYNC_BILLINGS_ON_READ=true` in the server environment to enable recomputation on cache misses. This prevents expensive billing syncs from slowing down every page load while still allowing manual refreshes when needed.

## Performance program (Phase 1 → Phase 4)

The project now includes a performance-upgrade track aligned to four phases:

1. **Phase 1 (Frontend payload + render)**
   - Route-prefetch on navigation hover/focus for faster route transitions.
   - Lazy chart loading on dashboard to reduce critical route JS.
   - Explicit vendor chunk split in Vite to improve browser cache reuse.
2. **Phase 2 (Backend response optimization)**
   - Single-flight summary aggregation prevents concurrent duplicate recomputation under load.
   - Existing Redis + memory cache remains in place for hot summary paths.
3. **Phase 3 (Live updates at scale)**
   - Live update events now include monotonic `version` values for better client-side dedupe/selective refresh behavior.
4. **Phase 4 (Performance observability + governance)**
   - Browser web vitals are reported to `POST /api/perf-metrics`.
   - API exposes `GET /api/perf-stats` with request timing summary, event versions, and recent vitals aggregates.

These improvements target near-instant interaction under normal production load and establish the telemetry needed to sustain a 9.5/10 performance target.
