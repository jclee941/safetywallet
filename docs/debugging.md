# SafetyWallet Runtime Debugging Guide

Comprehensive debugging setup for SafetyWallet's three-tier architecture: Cloudflare Workers API, Next.js Admin Dashboard, and Next.js Worker PWA.

## Quick Start

### 1. VS Code Debugging (Recommended)

Open the **Run and Debug** panel (`Ctrl+Shift+D` / `Cmd+Shift+D`) and select:

- **Debug: API Full Stack** — Launch API with inspector
- **Debug: Admin Full Stack** — Launch Admin server + Chrome debugger
- **Debug: Worker Full Stack** — Launch Worker server + Chrome debugger

### 2. Terminal Debugging

```bash
# Start API with inspector
npm run dev:inspect --workspace=apps/api

# Start Admin with inspector
npm run dev:inspect --workspace=apps/admin

# Start Worker with inspector
npm run dev:inspect --workspace=apps/worker

# Start all dev servers
npm run dev
```

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Worker PWA    │     │  Admin Dashboard│     │  Cloudflare API │
│   (Port 3000)   │◄────┤   (Port 3001)   │◄────┤   (Wrangler)    │
│  Next.js 15     │     │   Next.js 15    │     │  Hono + D1      │
│  Zustand + RQ   │     │  Zustand + RQ   │     │  KV + R2 + AI   │
│  Redux DevTools │     │  Redux DevTools │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                    TanStack Query Devtools
                    (React Query DevTools)
```

## Backend Debugging (Cloudflare Workers)

### Wrangler Dev with Inspector

```bash
cd apps/api
npm run dev:inspect  # Starts with Chrome DevTools inspector on port 9229
```

Press `D` in the terminal to open Chrome DevTools automatically.

### Key Debugging Features

| Feature       | Command/Method                 | Purpose                        |
| ------------- | ------------------------------ | ------------------------------ |
| Breakpoints   | Chrome DevTools                | Set breakpoints in source code |
| Console logs  | `wrangler dev` terminal        | View `console.log` output      |
| D1 queries    | `console.log({ sql, params })` | Log SQL before execution       |
| KV inspection | `await env.KV.list()`          | List KV keys programmatically  |
| CPU Profiling | DevTools Profiler tab          | Identify CPU-heavy functions   |

### Structured Logging

The API uses a unified structured logger at `apps/api/src/lib/logger.ts`:

```typescript
import { createLogger } from "./lib/logger";

const logger = createLogger("my-module");

logger.info("User action", { userId, siteId, action });
logger.warn("Cache miss", { key, duration });
logger.error("Database error", error, { query, userId });
logger.debug("Detailed trace", { data }); // Only visible in dev
```

Log output format (JSON):

```json
{
  "level": "info",
  "module": "my-module",
  "message": "User action",
  "service": "safetywallet",
  "timestamp": "2026-03-28T12:00:00Z",
  "userId": "123",
  "siteId": "456",
  "action": "create_post"
}
```

### Performance Timing

```typescript
import { startTimer } from "./lib/logger";

const timer = startTimer(logger);
// ... operation ...
timer.end("database_query", { userId, siteId });
// Output: { "message": "database_query completed", "duration": 45, ... }
```

### Debugging D1 Queries

Add temporary logging in routes:

```typescript
// Before query
console.log({
  sql: query.toSQL().sql,
  params: query.toSQL().params,
});

const result = await db.select().from(users).where(eq(users.id, id));

// After query
console.log({ result, rowCount: result.length });
```

### Debugging Durable Objects

The `JobScheduler` DO has built-in inspection actions:

```bash
# Get scheduler status
curl -X POST http://localhost:8787/api/admin/scheduler \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "status"}'

# List registered jobs
curl -X POST http://localhost:8787/api/admin/scheduler \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "list"}'
```

## Frontend Debugging (Next.js)

### TanStack Query Devtools

Both Admin and Worker apps include React Query Devtools. Look for the floating 🔍 icon in the bottom-left corner of the page (in development mode).

Features:

- **Query Inspector**: View cached data, status, and fetch times
- **Mutation Log**: Track all mutations and their states
- **Cache Management**: Manually invalidate or refetch queries
- **Timeline**: Visualize query lifecycle

### Zustand State Debugging

Install [Redux DevTools Extension](https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd) for Zustand state inspection.

Current stores with devtools enabled:

- `apps/admin/src/stores/auth.ts` — Admin auth state
- `apps/worker/src/stores/auth.ts` — Worker auth state

Stores are wrapped with `devtools()` middleware and will appear in Redux DevTools as "Admin Auth Store" and "Worker Auth Store".

### React DevTools

Install [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi) browser extension.

Features:

- Component tree inspection
- Props and state editing
- Performance profiler

### Server vs Client Components

| Aspect         | Server Components                     | Client Components   |
| -------------- | ------------------------------------- | ------------------- |
| Debug Location | Node.js DevTools (`chrome://inspect`) | Browser DevTools    |
| Source Maps    | `webpack://{app-name}/./`             | `webpack://_N_E/./` |
| State Access   | Not available                         | React DevTools      |
| "use client"   | Not needed                            | Required            |

### Debugging Server Components

```bash
# Start with Node.js inspector
npm run dev:inspect --workspace=apps/admin

# Open chrome://inspect in Chrome
# Look for "Remote Target" and click "inspect"
```

## VS Code Configuration

### Launch Configurations

The `.vscode/launch.json` provides these configurations:

```json
{
  "name": "API: Wrangler Dev (Inspector)",
  "type": "node",
  "request": "attach",
  "port": 9229
}
```

### Compound Debugging

Start multiple debuggers simultaneously:

```json
{
  "name": "Debug: API Full Stack",
  "configurations": ["API: Wrangler Dev (Launch)"]
}
```

```json
{
  "name": "Debug: Admin Full Stack",
  "configurations": ["Admin: Next.js Dev (Launch)", "Admin: Chrome Attach"]
}
```

```json
{
  "name": "Debug: Worker Full Stack",
  "configurations": ["Worker: Next.js Dev (Launch)", "Worker: Chrome Attach"]
}
```

### Tasks

Run all dev servers from VS Code:

1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Type "Tasks: Run Task"
3. Select "Start All Dev Servers"

## PWA/Offline Debugging (Worker App)

**Important:** PWA features (service worker, offline queue) are **disabled in development mode** by default (`next-pwa` config in `next.config.mjs`). To debug PWA features:

1. **Build and run production build locally:**

   ```bash
   cd apps/worker
   npm run build
   npx serve out
   ```

2. **Or temporarily enable PWA in dev** (not recommended for daily development):
   Edit `apps/worker/next.config.mjs` and set `disable: false` in the PWA config.

When PWA is enabled, use these debugging tools:

### Chrome DevTools Application Panel

1. Open DevTools → **Application** tab
2. **Service Workers**: Check registration, inspect console logs, simulate offline
3. **Storage** → **IndexedDB** → **`safetywallet-offline`**: Inspect `queueEntries` and `queueBlobs` stores
4. **Cache Storage**: View cached API responses and static assets
5. **Local Storage**: Inspect auth tokens and app state

### Offline Queue Debugging

The Worker app queues failed requests when offline. The queue is stored in IndexedDB:

- **Database**: `safetywallet-offline`
- **Stores**: `queueEntries` (request metadata), `queueBlobs` (file attachments)

```typescript
// Access the offline queue programmatically
import { getOfflineQueue } from "@/lib/offline-queue";

const entries = await getOfflineQueue();
console.log("Pending requests:", entries);
```

// Access the offline queue programmatically
import { getOfflineQueue } from "@/lib/offline-queue";

const entries = await getOfflineQueue();
console.log("Pending requests:", entries);

````

```typescript
// Access the offline queue programmatically
import { getOfflineQueue } from "@/lib/offline-queue";

const entries = await getOfflineQueue();
console.log("Pending requests:", entries);
````

// Access the offline queue programmatically
import { getOfflineQueue } from "@/lib/offline-queue";

const entries = await getOfflineQueue();
console.log("Pending requests:", entries);

```
// Access the offline queue programmatically
import { getOfflineQueue } from "@/lib/offline-queue";

const entries = await getOfflineQueue();
console.log("Pending requests:", entries);
```

### Service Worker Debugging

```javascript
// Force update service worker (bypass waiting)
navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });

// Unregister service worker for fresh start
navigator.serviceWorker.getRegistrations().then((regs) => {
  regs.forEach((reg) => reg.unregister());
});
```

### Network Throttling

In Chrome DevTools Network tab:

1. Select "Offline" preset to simulate no connection
2. Select "Slow 3G" to test queue behavior
3. Observe offline queue indicator in the UI

### Common PWA Issues

| Issue                       | Solution                                             |
| --------------------------- | ---------------------------------------------------- |
| Service worker not updating | Hard refresh (Cmd+Shift+R) or unregister in DevTools |
| Cache showing old content   | Clear "Cache Storage" in Application tab             |
| Offline queue not syncing   | Check `navigator.onLine` and network conditions      |
| IndexedDB errors            | Check storage quota in Application → Storage         |

## Common Debugging Scenarios

### Scenario 1: API Route Not Working

1. Check logs in `wrangler dev` terminal
2. Add `console.log()` at route entry
3. Use VS Code debugger: set breakpoint in route handler
4. Check D1 query with `console.log({ sql: query.toSQL() })`

### Scenario 2: Frontend Not Updating

1. Open TanStack Query Devtools (🔍 icon)
2. Check if query is stale or fetching
3. Manually trigger refetch in Devtools
4. Check Zustand state in Redux DevTools

### Scenario 3: Authentication Issues

1. Check auth store in Redux DevTools
2. Verify token in Application tab → Local Storage
3. Check API logs for JWT validation errors
4. Use network tab to inspect request/response headers

### Scenario 4: Performance Issues

1. Use React DevTools Profiler to identify slow renders
2. Check TanStack Query cache hit rates
3. Use API performance timers: `startTimer(logger).end("action")`
4. Use Chrome DevTools Performance tab for flame charts

### Scenario 5: Offline Queue Not Working

1. Ensure PWA is enabled (see PWA Debugging section above)
2. Open Application → IndexedDB → `safetywallet-offline`
3. Check if `queueEntries` store exists and has items
4. Check console for service worker errors
5. Verify `navigator.onLine` status in console
6. Trigger manual sync via Offline Queue Indicator UI

## Production Debugging

## Common Debugging Scenarios

### Scenario 1: API Route Not Working

1. Check logs in `wrangler dev` terminal
2. Add `console.log()` at route entry
3. Use VS Code debugger: set breakpoint in route handler
4. Check D1 query with `console.log({ sql: query.toSQL() })`

### Scenario 2: Frontend Not Updating

1. Open TanStack Query Devtools (🔍 icon)
2. Check if query is stale or fetching
3. Manually trigger refetch in Devtools
4. Check Zustand state in Redux DevTools

### Scenario 3: Authentication Issues

1. Check auth store in Redux DevTools
2. Verify token in Application tab → Local Storage
3. Check API logs for JWT validation errors
4. Use network tab to inspect request/response headers

### Scenario 4: Performance Issues

1. Use React DevTools Profiler to identify slow renders
2. Check TanStack Query cache hit rates
3. Use API performance timers: `startTimer(logger).end("action")`
4. Use Chrome DevTools Performance tab for flame charts

### Scenario 5: Offline Queue Not Working

1. Open Application → IndexedDB → `safetywallet-offline`
2. Check if `queueEntries` exists
3. Check console for service worker errors
4. Verify `navigator.onLine` status in console
5. Trigger manual sync via Offline Queue Indicator UI

## Production Debugging

### Wrangler Tail (Live Logs)

```bash
# Stream production logs
npx wrangler tail --format pretty

# Filter by status
npx wrangler tail --status error

# Filter by method
npx wrangler tail --method POST
```

### Analytics Engine

Production metrics are written to Cloudflare Analytics Engine:

- Request counts and latency
- Error rates by endpoint
- Custom business events

Access via Cloudflare Dashboard → Workers → Analytics.

### Elasticsearch Logging

Error and warn logs are shipped to Elasticsearch:

```bash
# Query recent errors
curl "$ELASTICSEARCH_URL/safetywallet-logs-*/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "bool": {
        "must": [
          { "term": { "level": "error" } },
          { "range": { "@timestamp": { "gte": "now-1h" } } }
        ]
      }
    }
  }'
```

## Debugging Checklist

Before reporting an issue, check:

- [ ] Browser console for JavaScript errors
- [ ] Network tab for failed API calls
- [ ] TanStack Query Devtools for query status
- [ ] Redux DevTools for state inconsistencies
- [ ] API logs in `wrangler dev` terminal
- [ ] D1 queries with SQL logging enabled
- [ ] KV state with programmatic inspection
- [ ] Service Worker status (for Worker app)
- [ ] IndexedDB offline queue (for Worker app)

## Security Notes

- Never commit debug credentials or `.dev.vars`
- Remove temporary `console.log()` statements before PR
- Debug endpoints (e.g., `/debug/*`) should require admin auth
- Disable inspector in production builds

## References

- [Cloudflare Workers DevTools](https://developers.cloudflare.com/workers/observability/dev-tools/)
- [Next.js Debugging](https://nextjs.org/docs/app/guides/debugging)
- [TanStack Query DevTools](https://tanstack.com/query/latest/docs/framework/react/devtools)
- [Zustand DevTools](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice#devtools)
