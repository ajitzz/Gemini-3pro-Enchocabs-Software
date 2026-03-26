# Data Loading Performance Troubleshooting Playbook

Use this playbook when pages or APIs feel slow and the root cause is unclear.

## 1) Establish a baseline first (before changing anything)

Capture these numbers for a known slow screen/API:

- Browser:
  - TTFB (time to first byte)
  - API request duration (fastest/slowest)
  - payload size per endpoint
- Backend:
  - p50 / p95 response time by route
  - DB query duration per major query
  - cache hit ratio (Redis)
- Infrastructure:
  - Render cold start frequency
  - region mismatch across Render / DB / Redis

> Rule: if you cannot measure it, you cannot confidently optimize it.

---

## 2) Fast triage decision tree

1. **Is the first request after idle very slow, but later requests are fast?**
   - Likely Render cold start and/or connection setup.
2. **Are all requests consistently slow?**
   - Likely DB/index/query plan or payload size issue.
3. **Are some requests fast and some very slow for same endpoint?**
   - Likely cache misses, lock contention, or cron overlap.
4. **Does UI block before API calls complete?**
   - Likely route/auth gating and sequential client fetching.

---

## 3) Cron jobs (scheduler) checklist

### Correctness + concurrency

- Ensure each cron job has an idempotency strategy:
  - lock key in Redis (e.g. `cron:<job>:lock`), short TTL.
  - skip if lock exists.
- Prevent overlapping runs:
  - job runtime must be less than schedule interval.
  - if runtime can exceed interval, change to queue-driven processing.
- Add dead-letter/retry policy for failed tasks.

### Performance impact

- Verify cron jobs do not run expensive full-table scans during peak user hours.
- Move heavy recomputation to:
  - incremental updates,
  - batched pagination,
  - off-peak windows.
- Record job metrics:
  - start/end time,
  - rows processed,
  - failures,
  - queue depth.

### Anti-patterns to remove

- Cron job recomputes the same aggregate that user API recomputes on every read.
- Multiple cron workers process identical key ranges without partitioning.

---

## 4) Redis checklist

### Connectivity and topology

- Confirm Redis endpoint uses TLS (`rediss://`) when required.
- Keep Redis in the same/near region as Render and DB.
- Monitor connection reuse (avoid reconnecting per request).

### Cache strategy

- Define cache key ownership per endpoint (who sets, who invalidates).
- Use TTL by data volatility:
  - static config: longer TTL,
  - frequently changing balances: shorter TTL + event invalidation.
- Apply stale-while-revalidate for non-critical freshness paths.

### Hit ratio and size

- Track hit/miss by key namespace (e.g. `driver-billings:*`, `portal:*`).
- If hit ratio is low:
  - inspect key mismatch,
  - TTL too short,
  - invalidation too broad.
- Avoid caching extremely large unbounded payloads.

### Safety guards

- Add request coalescing/single-flight for expensive recomputation to prevent thundering herd.
- Add a circuit breaker fallback path when Redis is degraded.

---

## 5) Render checklist

### Cold start and instance behavior

- Check if slow requests map to instance startup windows.
- Keep-alive can reduce cold starts, but validate real impact with timestamps.
- Ensure min instances / plan choice matches required latency SLO.

### Region and network

- Verify region alignment:
  - Render service,
  - Postgres,
  - Redis,
  - queue provider.
- Every cross-region call adds RTT and can multiply with sequential calls.

### Runtime settings

- Validate Node memory/CPU are not throttled.
- Verify DB pool size and Redis pool settings are tuned for traffic level.

---

## 6) API design checklist (high impact)

- Replace multiple startup API calls with one bootstrap endpoint for each main screen.
- Enforce pagination/date filters by default for history-heavy endpoints.
- Return only needed columns/fields.
- Compress large JSON responses.
- Avoid N+1 query patterns in route handlers.

---

## 7) Database checklist

- Run `EXPLAIN ANALYZE` for top 5 slow queries.
- Add/adjust indexes for:
  - `WHERE`, `JOIN`, `ORDER BY` columns used together.
- Validate no missing index on common filters (`driver_id`, date ranges).
- Pre-aggregate heavy analytics tables if near-real-time is acceptable.

---

## 8) Frontend rendering checklist

- Prevent blocking full-screen loaders during route transitions if data can stream progressively.
- Render cached/last-known data immediately, refresh in background.
- Parallelize independent API calls; remove unnecessary sequencing.
- Debounce heavy filters/search on large lists.

---

## 9) Observability checklist (must-have)

Implement per-request telemetry with:

- route
- total duration
- DB time
- Redis time
- cache hit/miss
- payload bytes
- cold-start marker
- trace/request id

Also log cron job spans and attach correlation ids to queue/cron-triggered recomputations.

---

## 10) 7-day action plan to reduce load time

### Day 1
- Instrument endpoint timing and cache hit metrics.
- Identify top 3 slow endpoints by p95.

### Day 2
- Add/validate DB indexes for those endpoints.
- Enforce pagination/date bounds for heavy routes.

### Day 3
- Add or fix Redis keys + TTL + invalidation for top endpoints.
- Add single-flight around expensive recomputation.

### Day 4
- Add bootstrap API for main portal/dashboard screen.
- Shift frontend to stale-while-revalidate UI.

### Day 5
- Harden cron jobs with locks + idempotency + overlap prevention.
- Move heavy cron windows off-peak.

### Day 6
- Validate Render region alignment and cold-start mitigation.
- Tune DB/Redis pool sizes.

### Day 7
- Compare before/after p50, p95, and user-perceived load time.
- Keep only changes that produce measurable gains.

---

## 11) Quick “what to check first” summary for your case

Given your symptoms (huge data-loading delay), start in this order:

1. Endpoint timing + payload size for the slow screen.
2. Redis hit ratio and key correctness.
3. DB query plan/indexes for slow endpoints.
4. Cron overlap/recompute conflicts during user traffic.
5. Render cold starts and region mismatch.
6. Frontend sequential calls and blocking auth/route loaders.

If you share one slow endpoint trace (request timeline + SQL + cache status), optimization can usually be narrowed down quickly.

---

## 12) Postgres region-move cutover checklist (after creating a new Singapore DB)

If data was already copied to a new regional DB, execute these steps to avoid partial cutover issues:

1. Update app env to the new DB:
   - set `DATABASE_URL` to the new regional connection string
   - remove/replace old DB URLs to prevent accidental fallback
2. Redeploy backend and verify startup log confirms successful PostgreSQL connection.
3. Validate data parity on business-critical tables (`drivers`, `daily_entries`, `driver_billings`, `weekly_wallets`, `lead_updates`).
4. Execute write-path smoke tests:
   - create/edit daily entry
   - refresh driver billing
   - update lead status
5. Watch production telemetry for 30-60 minutes:
   - p95 API latency
   - DB query times
   - error rate
6. Keep old DB available as rollback target for 24-72 hours, then decommission.
