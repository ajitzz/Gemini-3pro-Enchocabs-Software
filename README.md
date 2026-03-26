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

### Fix for backend `Origin not allowed by CORS` on Vercel preview URLs

If Render logs repeatedly show `Origin not allowed by CORS` for preview domains (for example `...vercel.app`), configure backend CORS env vars:

- `CORS_ORIGINS` - comma-separated exact origins.
- `CORS_ORIGIN_PATTERNS` - comma-separated wildcard patterns for dynamic preview domains.

Example:

`CORS_ORIGINS=https://enchocabs.com,https://www.enchocabs.com`

`CORS_ORIGIN_PATTERNS=https://gemini-3pro-enchocabs-software-*.vercel.app`

After updating env vars, redeploy backend on Render.

Tip: if you set `CORS_ORIGIN_PATTERNS=https://<project>.vercel.app` (without `*`), the server now also accepts preview URLs for the same Vercel project slug (`https://<project>-<preview-id>.vercel.app`).
Tip: do not include path values like `/` or `/api` in CORS origins/patterns. Use origin only (scheme + host). The server now normalizes common trailing-slash entries automatically.
For your current project naming style, both of these are valid:
- `CORS_ORIGIN_PATTERNS=https://gemini-3pro-enchocabs-software.vercel.app` (auto-allows same-project previews)
- `CORS_ORIGIN_PATTERNS=https://gemini-3pro-enchocabs-software-*.vercel.app` (explicit wildcard)

Set `VITE_API_URL` in your frontend deployment environment:

- Recommended: `https://<your-backend>.onrender.com/api`
- Also accepted by the app: `<your-backend>.onrender.com/api` (the client auto-adds `https://`)
- Local/dev proxy: `/api`

If this value is malformed, browsers can throw SSL/network errors when loading data. After updating env vars in Vercel, trigger a fresh redeploy.

## Redis configuration

If you enable caching, set `REDIS_URL` (or `UPSTASH_REDIS_URL`) to the raw connection string, **not** a `redis-cli -u ...` command. Managed Redis providers such as Redis Cloud/RedisLabs typically require TLS; use a `rediss://` URL for those hosts. Example: `REDIS_URL=rediss://default:<password>@<host>:<port>`. On Vercel, add this exact `rediss://` value as a project environment variable so the server connects over TLS.

## PostgreSQL SSL warning note

If Render logs show this Node warning from `pg-connection-string` about ssl modes (`prefer`, `require`, `verify-ca`), the server now normalizes the database URL by adding `useLibpqCompat=true` when needed. This keeps current behavior stable while newer pg/libpq semantics roll out.

## After moving PostgreSQL to a new region (example: US-East → Singapore)

If you created a new DB in a closer region and imported data, apply this checklist before calling migration complete:

1. Update backend environment variable:
   - `DATABASE_URL=postgresql://...new-singapore-host.../neondb?sslmode=require&channel_binding=require`
   - If `POSTGRES_URL` is also set in Render, keep only one source of truth (prefer `DATABASE_URL`) to avoid accidental fallback to old DB.
2. Redeploy backend service so new env vars are loaded.
3. Validate connection target from logs:
   - Startup should show `Successfully connected to PostgreSQL database`.
   - You should no longer see app traffic hitting old US-East DB metrics.
4. Verify row counts on critical tables in the new DB:
   - `drivers`, `daily_entries`, `driver_billings`, `weekly_wallets`, `leads`.
5. Run a smoke test from UI/API:
   - Login, open dashboard, driver billings, daily entries, and lead pages.
   - Confirm create/update flows persist to the new DB.
6. Keep old DB read-only for 24-72 hours rollback window, then decommission.

### Optional but recommended post-move tuning

- Keep Render + Postgres + Redis in Singapore for lowest latency.
- Track p95 route latency before/after cutover to confirm improvement.

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


## Performance troubleshooting playbook

For step-by-step diagnosis of slow data loads across cron jobs, Redis, Render, API design, DB, and frontend rendering, see [`PERFORMANCE_TROUBLESHOOTING_PLAYBOOK.md`](./PERFORMANCE_TROUBLESHOOTING_PLAYBOOK.md).

## Mobile home screen widget options for driver net balance/payout

If you want each driver to see **Net Balance** and **Net Payout** directly from their phone home screen, there are two practical paths:

1. **Progressive Web App (PWA) + Add to Home Screen** (recommended fastest path)
   - Keep this app as web-first.
   - Add PWA support (manifest + service worker) so drivers can install it from browser to home screen.
   - Open directly to `/portal` and show a compact “widget-style” summary card at the top.
   - Use existing `/api/live-updates` SSE stream for near-live refresh inside the app.

2. **Native home-screen widgets (Android/iOS)**
   - True OS widgets (outside browser) need native apps:
     - Android: App Widget / Jetpack Glance.
     - iOS: WidgetKit.
   - Your native app can call this backend API and render Net Balance / Net Payout in an actual phone widget.

### Recommendation

- Start with **PWA install + portal summary card** for speed and lower cost.
- Move to native widgets only if you need “always-visible” numbers without opening the app.

### Suggested API response for widget summary

Expose a small endpoint for fast mobile refresh, e.g.:

`GET /api/drivers/:driverId/widget-summary`

Response example:

```json
{
  "driverId": "...",
  "driverName": "...",
  "netBalance": 1250,
  "netPayout": 980,
  "netPayoutSource": "latest-wallet",
  "updatedAt": "2026-03-04T10:30:00.000Z"
}
```

This keeps the widget lightweight and avoids fetching the full portal payload on every refresh.


## Step-by-step: implement this from the current website

Use this sequence to deliver driver-facing mobile widgets from the existing codebase without a full rewrite.

### Phase A — ship a “widget-like” mobile card in the current Driver Portal (fastest)

1. **Keep `/portal` as the single driver entry point**
   - Driver route already exists and is role-protected in `App.tsx`.
2. **Create a compact top card component** (example: `components/driver/DriverBalanceWidgetCard.tsx`)
   - Show: `Net Balance`, `Net Payout`, `last updated`, and a tiny status dot.
   - Reuse values already computed in `DriverPortalPage.tsx` (`netBalance`, `balanceSummary.netPayout`).
3. **Render this card at the top of the mobile layout in `DriverPortalPage.tsx`**
   - Keep large touch targets and high-contrast numbers.
4. **Use existing live update pipeline**
   - Keep `useLiveUpdates` hook + fallback polling as-is so numbers refresh near-live.
5. **Add “Updated just now / Xm ago” label**
   - Use last refresh timestamp in state; this builds driver trust in live data.

Result: drivers install/open the site and immediately see widget-like numbers inside the web app.

### Phase B — make it installable on home screen (PWA)

1. Add a web app manifest (`public/manifest.webmanifest`):
   - app name, icons, `display: standalone`, `start_url: /portal`.
2. Add a service worker (via Vite plugin like `vite-plugin-pwa` or a manual worker).
3. Cache shell assets and keep API requests network-first.
4. Add install prompt UI on login/portal (`Install app`).

Result: drivers can pin the app to home screen and open directly to portal like a native app.

### Phase C — optimize backend payload for mobile card

1. Add endpoint: `GET /api/drivers/:driverId/widget-summary`.
2. In handler, reuse existing summary math (same logic used for portal stats) to avoid mismatch.
3. Return only small payload (`netBalance`, `netPayout`, `source`, `updatedAt`).
4. Enforce auth: driver can only read their own `driverId` unless admin/super_admin.

Result: fast refresh, less mobile data usage, no heavy full-page fetch for simple cards.

### Phase D — true OS home-screen widgets (optional, native)

- If you need numbers visible **without opening app**:
  - Android: native app + App Widget/Glance.
  - iOS: native app + WidgetKit.
- Native widget calls the same `widget-summary` endpoint.

### Minimal implementation checklist (repo-focused)

- [ ] Build `DriverBalanceWidgetCard` UI component.
- [ ] Mount component in `DriverPortalPage.tsx` mobile-first position.
- [ ] Add `updatedAt` state + relative-time label.
- [ ] Add PWA manifest + icons + service worker.
- [ ] Add install CTA in portal/login.
- [ ] Add `/api/drivers/:driverId/widget-summary` route with auth guard.
- [ ] QA on Android Chrome + iOS Safari add-to-home-screen flow.

### Security & correctness guardrails

- Never trust `driverId` from client alone; validate from authenticated session.
- Keep one shared calculation function for portal and widget endpoint.
- Emit/consume existing live events (`daily_entries_changed`, `weekly_wallets_changed`) to keep data consistent.

### Suggested rollout (1 week)

- **Day 1–2:** Phase A (mobile widget card in portal).
- **Day 3:** Phase B (PWA installability).
- **Day 4:** Phase C (`widget-summary` endpoint + auth).
- **Day 5:** QA + production deploy + driver onboarding message.


### Native widget backend endpoint (implemented)

For Android/iOS true home-screen widgets, use:

- `GET /api/drivers/:driverId/widget-summary`

Response includes:

- `driverId`
- `driverName`
- `netBalance`
- `netPayout`
- `netPayoutSource`
- `netPayoutRange`
- `updatedAt`

Security option:

- Set `WIDGET_ACCESS_TOKEN` in backend env.
- Pass token via `X-Widget-Token` header (or `?token=` query for simple widget clients).
- If `WIDGET_ACCESS_TOKEN` is unset, endpoint remains open (recommended only for trusted internal setups).
