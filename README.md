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

## Keep the Render service warm (optional)

If you are deploying to Render's free tier and want to reduce cold-start delays, set a `KEEP_ALIVE_URL` environment variable to the deployed URL you want pinged (for example, `https://<your-app>.onrender.com/health`). The server will ping this URL on startup and then every 14 minutes by default (configure with `KEEP_ALIVE_INTERVAL_MINUTES`).
