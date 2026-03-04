# Performance Audit Report (Render + Upstash deployment)

## Why loading is still slow on non-home pages

After reviewing the current frontend and backend flow, the slow pages are mainly caused by **request sequencing and server wake/latency**, not just missing Redis cache.

### 1) Protected pages trigger auth validation on each page mount
- All non-home pages are behind `ProtectedRoute`.
- `ProtectedRoute` calls `refreshSession()` for admin users and shows a blocking spinner while validating.
- This introduces a network dependency before rendering protected content.

### 2) Session validation was too frequent
- `AuthContext` was validating very aggressively (short grace window + 15s interval), which increases backend load and can create perceived delay during navigation when the server is under load.

### 3) Driver portal does multiple API calls during initialization
- Driver portal startup requires drivers + rental slabs + manager access + daily entries + weekly wallets (+ cash modes for team members).
- Even with Redis, many requests are still required, and total wait is limited by slowest call.

### 4) Render cold start + regional latency still dominates first protected request
- Redis improves repeated query performance, but it **does not remove**:
  - render instance spin-up (cold starts)
  - TLS + network RTT to DB/Redis/API regions
  - frontend waiting for auth gate responses

### 5) Large payload routes are still expensive
- Endpoints like daily entries / weekly wallets can return large arrays.
- If the first request is uncached or bypasses cache (`fresh=1` paths), perceived loading remains high.

## Changes applied in this update

1. **Removed route-change revalidation in `ProtectedRoute`**
   - Admin revalidation now runs on auth context changes instead of every pathname transition.
   - This prevents unnecessary full-page blocking spinner on each internal navigation.

2. **Reduced validation pressure in `AuthContext`**
   - Increased validation grace period from 2 minutes to 10 minutes.
   - Reduced background validation interval from 15 seconds to 60 seconds.
   - This lowers API chatter and improves protected-route responsiveness.

## Next steps (high impact)

1. Add a **single portal bootstrap endpoint** that returns all portal-needed data in one response.
2. Add **stale-while-revalidate UI strategy** for protected pages (render cached local state first, refresh in background).
3. Ensure Render service runs in same region as Postgres + Upstash.
4. Add endpoint-level timing logs (p50/p95) and surface in `/api/perf-metrics` dashboard.
5. Paginate or date-bound large list APIs by default, especially for historical daily entries.

## Quick verification checklist

- Navigate across `/app` routes repeatedly and confirm no repeated blocking auth spinner.
- Compare request counts before/after for `/api/admin-access` and related auth validation calls.
- Measure first protected route TTFB with warm and cold service states.
