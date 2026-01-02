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

## Keep the Render service warm (optional)

If you are deploying to Render's free tier and want to reduce cold-start delays, set a `KEEP_ALIVE_URL` environment variable to the deployed URL you want pinged (for example, `https://<your-app>.onrender.com/health`). The server will ping this URL on startup and then every 14 minutes by default (configure with `KEEP_ALIVE_INTERVAL_MINUTES`).

## Production health monitoring

The API already exposes a lightweight `/health` endpoint that responds with `200` and `{ status: 'ok' }` from both the Edge worker and the Express server. To monitor uptime without adding load:

1. In UptimeRobot, create an HTTP(s) monitor pointed to `<your-domain>/health`. Both `GET` and `HEAD` respond with `200` and `{ status: 'ok' }`, and they set `Cache-Control: no-store` so you always hit live code.
2. Set the interval to 5 minutes so the check stays snappy while keeping free-tier allowances in mind.
3. (Optional) Keep the existing `KEEP_ALIVE_URL` pointing at the same `/health` URL if you want Render dynos to stay warm in addition to external monitoring.

This approach keeps checks fast and side-effect free while giving you early warning if deployments go down.
