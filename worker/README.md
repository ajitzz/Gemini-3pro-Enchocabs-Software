# Cloudflare Worker migration plan

This folder contains the Worker-based backend that replaces the Render Express server while keeping the Render Postgres database/schema unchanged and routing through Cloudflare Hyperdrive.

## Goals
- Cloudflare Worker (Hono router) + Render Postgres via Hyperdrive
- Same REST paths/JSON shapes as the existing Express app
- No keep-alive loop, no startup migrations, no background `setInterval`
- Google login supported via `jose` in the Worker runtime
- Scheduled cron (every 5 minutes) replaces the previous `setInterval(syncDriverBillings)`

## Project structure
- `worker/wrangler.toml` – Worker config with `nodejs_compat`, Hyperdrive binding, and cron trigger.
- `worker/src/index.ts` – Worker entry and routes. Includes examples for health, Google auth, driver billings (lightweight GET), and daily entry bulk insert (transaction example). Remaining routes are scaffolded as placeholders to migrate from `server/index.js`.
- `worker/src/db.ts` – Hyperdrive-backed `query` and `withTransaction` helpers (no global pools).
- `worker/package.json` – Worker-only dependencies (`hono`, `jose`, `pg`, `wrangler`).
- `worker/tsconfig.json` – TypeScript settings for Workers.

## Hyperdrive setup (Render Postgres)
1. From Cloudflare dashboard, create Hyperdrive and point it at your Render Postgres **EXTERNAL DATABASE URL** (no schema changes needed).
2. Copy the generated Hyperdrive ID and paste it into `worker/wrangler.toml` under `[[hyperdrive]] id = "..."`.
3. The Worker will read the connection string from `env.HYPERDRIVE.connectionString` automatically.

## Environment variables (set in Cloudflare dashboard or `wrangler.toml` for dev)
- `ALLOWED_ORIGINS` – comma-separated origins (leave blank to allow all; works for Vercel frontend).
- `SUPER_ADMIN_EMAIL`
- `GOOGLE_CLIENT_ID`

### Moving variables from Vercel
Your Vercel project values (e.g., `GOOGLE_CLIENT_ID`, `SUPER_ADMIN_EMAIL`, and any other secrets used by the backend) should be
copied into Cloudflare so the Worker can read them:

1. **Export from Vercel**: In the Vercel dashboard, open **Settings → Environment Variables** for your backend and copy the
   current values.
2. **Create Cloudflare secrets**: For sensitive values (tokens, client secrets), run inside `worker/`:
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put SUPER_ADMIN_EMAIL
   # repeat for any additional secret values you previously kept in Vercel
   ```
   Alternatively, add them in the Cloudflare dashboard under **Workers → your Worker → Settings → Variables**.
3. **Set non-secret text variables**: For public strings like CORS allowlist, either set them in the dashboard or add to
   `wrangler.toml` under `[vars]` (e.g., `ALLOWED_ORIGINS = "https://your-vercel-app.vercel.app"`).
4. **Hyperdrive binding**: Confirm the `[[hyperdrive]]` block in `wrangler.toml` points to your Render Postgres external URL,
   or recreate the binding in the dashboard. No Vercel change is needed for the database itself.
5. **Vercel frontend**: No environment changes are required on Vercel unless your frontend calls the Worker at a new origin;
   update `ALLOWED_ORIGINS` accordingly and point the frontend API base URL to the Worker deployment.

## CORS
CORS is handled via Hono middleware; allowlist comes from `ALLOWED_ORIGINS`. Empty allowlist defaults to `*`.

## Driver billing sync strategy
- Heavy billing computation should run in the cron handler instead of on each request. The scheduled handler calls `refresh_driver_billings()`; create or migrate an equivalent SQL function that encapsulates the previous `syncDriverBillings` logic so the GET endpoint only performs a select.

## Running locally
```bash
cd worker
npm install
npm run dev -- --local # uses wrangler dev with nodejs_compat
```

## Deploying
```bash
cd worker
npm run deploy
```
Ensure the Hyperdrive binding and env vars are configured in Cloudflare before deploying.

## Migration checklist
- [x] Replace Express with Hono router
- [x] Remove keep-alive/startup initDb/setInterval
- [x] Add Hyperdrive-based DB helpers with per-request clients
- [x] Add cron trigger for billing sync
- [ ] Port remaining routes from `server/index.js` into `src/index.ts` (placeholders included)
