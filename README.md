# @flyweightdev/convex-revenuecat

A Convex component for syncing RevenueCat entitlements and virtual currency balances into your Convex database. Uses the [RevenueCat REST API v2](https://www.revenuecat.com/docs/api-v2) for all operations.

Inspired by [@flyweightdev/convex-paddle](https://github.com/flyweightdev/convex-paddle).

This project was created with the help of Claude Code (Opus 4.6) and reviewed by GPT-5.3-Codex, CodeRabbitAI and humans.

## Features

- **Entitlement Sync** — Full resync from RevenueCat REST API v2 on every webhook event
- **Virtual Currency** — Sync balances, spend currency via RevenueCat v2 API
- **Cross-Platform** — Mobile in-app purchases + web Paddle checkout, unified via RevenueCat
- **Reactive Queries** — Check entitlements and currency balances in real-time with Convex reactive queries
- **Webhook Handling** — Idempotent processing of all RevenueCat webhook events
- **Post-Purchase Polling** — Poll RevenueCat after Paddle checkout until entitlements appear
- **Configurable User ID** — Map any auth provider (Clerk, Auth0, etc.) to RevenueCat app_user_id

## Architecture

```
Mobile (RN) ──> RevenueCat SDK ──> RevenueCat
Web ──> Paddle.js checkout ──> Paddle webhooks ──> RevenueCat
                                                      │
                                      ┌───────────────┤
                                      │               │
                                RC REST API      RC Webhooks
                                (fetch/poll)     (push events)
                                      │               │
                                      └───────┬───────┘
                                              ▼
                                      Convex DB (cache)
                                              │
                                              ▼
                                      Reactive queries → UI
```

## Quick Start

### 1. Install the Component

```bash
npm install @flyweightdev/convex-revenuecat
```

### 2. Add to Your Convex App

Create or update `convex/convex.config.ts`:

```typescript
import { defineApp } from "convex/server";
import revenuecat from "@flyweightdev/convex-revenuecat/convex.config.js";

const app = defineApp();
app.use(revenuecat);

export default app;
```

### 3. Set Up Environment Variables

Add these to your [Convex Dashboard](https://dashboard.convex.dev) → Settings → Environment Variables:

| Variable                      | Description                                           |
| ----------------------------- | ----------------------------------------------------- |
| `REVENUECAT_API_KEY`          | RevenueCat secret API key (`sk_...`)                  |
| `REVENUECAT_WEBHOOK_AUTH_KEY` | Auth key configured in RevenueCat webhook settings    |
| `REVENUECAT_PROJECT_ID`       | RevenueCat project ID (required for all v2 API calls) |

### 4. Configure RevenueCat Webhooks

1. Go to your [RevenueCat Dashboard](https://app.revenuecat.com) → Project → Integrations → Webhooks
2. Add a new webhook destination with your Convex HTTP endpoint:
   ```
   https://<your-convex-deployment>.convex.site/revenuecat/webhook
   ```
3. Set the **Authorization header** to `Bearer <your-REVENUECAT_WEBHOOK_AUTH_KEY>`
4. RevenueCat will send events for purchases, renewals, cancellations, etc.

### 5. Register Webhook Routes

Create `convex/http.ts`:

```typescript
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { registerRoutes } from "@flyweightdev/convex-revenuecat";

const http = httpRouter();

registerRoutes(http, components.revenuecat, {
  webhookPath: "/revenuecat/webhook",
});

export default http;
```

### 6. Use the Component

Create `convex/revenuecat.ts`:

```typescript
"use node";

import { action, query } from "./_generated/server";
import { components } from "./_generated/api";
import { RevenueCatSync } from "@flyweightdev/convex-revenuecat";
import { v } from "convex/values";

const rcClient = new RevenueCatSync(components.revenuecat);

// ============================================================================
// USER ID MAPPING — Customize this for your auth provider
// ============================================================================

/**
 * Map your auth identity to a RevenueCat app_user_id.
 *
 * This must match the user ID you configure in your mobile app's
 * RevenueCat SDK and in your Paddle checkout custom_data.
 *
 * Examples:
 * - Clerk:   identity.subject
 * - Auth0:   identity.subject
 * - Custom:  identity.tokenIdentifier
 */
function getAppUserId(identity: { subject: string }): string {
  return identity.subject;
}

// ============================================================================
// SYNC
// ============================================================================

export const syncEntitlements = action({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await rcClient.syncSubscriber(ctx, {
      appUserId: getAppUserId(identity),
    });
  },
});

export const waitForEntitlement = action({
  args: { entitlementId: v.string() },
  returns: v.object({ found: v.boolean(), attempts: v.number() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await rcClient.pollForEntitlement(ctx, {
      appUserId: getAppUserId(identity),
      entitlementId: args.entitlementId,
    });
  },
});

// ============================================================================
// QUERIES (reactive)
// ============================================================================

export const getMyEntitlements = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.runQuery(components.revenuecat.public.getActiveEntitlements, { appUserId: getAppUserId(identity) });
  },
});

export const hasEntitlement = query({
  args: { entitlementId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    return await ctx.runQuery(components.revenuecat.public.hasActiveEntitlement, { appUserId: getAppUserId(identity), entitlementId: args.entitlementId });
  },
});
```

## API Reference

### RevenueCatSync Client

```typescript
import { RevenueCatSync } from "@flyweightdev/convex-revenuecat";

const rcClient = new RevenueCatSync(components.revenuecat, {
  REVENUECAT_API_KEY: "sk_...", // Optional, defaults to process.env.REVENUECAT_API_KEY
  REVENUECAT_PROJECT_ID: "proj_...", // Optional, defaults to process.env.REVENUECAT_PROJECT_ID
});
```

#### Methods

| Method                                                                             | Description                                                                         |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `syncSubscriber(ctx, { appUserId })`                                               | Fetch customer from RevenueCat REST API v2 and sync entitlements to Convex DB |
| `pollForEntitlement(ctx, { appUserId, entitlementId, maxAttempts?, intervalMs? })` | Poll until a specific entitlement becomes active                              |
| `syncVirtualCurrencyBalances(ctx, { appUserId })`                                  | Fetch virtual currency balances from RevenueCat REST API v2 and sync to Convex DB |
| `spendVirtualCurrency(ctx, { appUserId, adjustments, idempotencyKey? })`           | Spend virtual currency via RevenueCat v2 API and sync updated balances        |

### registerRoutes

```typescript
import { registerRoutes } from "@flyweightdev/convex-revenuecat";

registerRoutes(http, components.revenuecat, {
  webhookPath: "/revenuecat/webhook", // Optional, default
  REVENUECAT_WEBHOOK_AUTH_KEY: "...", // Optional, defaults to env var
  REVENUECAT_API_KEY: "...", // Optional, defaults to env var
  REVENUECAT_PROJECT_ID: "...", // Optional, defaults to env var (required for all v2 API calls)
  events: {
    // Optional per-event handlers
    INITIAL_PURCHASE: async (ctx, event) => {},
    RENEWAL: async (ctx, event) => {},
    CANCELLATION: async (ctx, event) => {},
  },
  onEvent: async (ctx, event) => {}, // Optional catch-all handler
});
```

### Component Queries

Access data directly via the component's public queries:

| Query                        | Arguments                  | Description                                       |
| ---------------------------- | -------------------------- | ------------------------------------------------- |
| `getActiveEntitlements`      | `appUserId`                | Get all active entitlements for a user            |
| `hasActiveEntitlement`       | `appUserId, entitlementId` | Check if a user has a specific active entitlement |
| `getEntitlements`            | `appUserId`                | Get all entitlements (active and inactive)        |
| `getEntitlement`             | `appUserId, entitlementId` | Get a specific entitlement                        |
| `getSubscriber`              | `appUserId`                | Get cached subscriber record                      |
| `getVirtualCurrencyBalances` | `appUserId`                | Get all cached virtual currency balances          |
| `getVirtualCurrencyBalance`  | `appUserId, currencyCode`  | Get a specific virtual currency balance           |

## Webhook Events

The component handles these RevenueCat webhook events:

### Events that trigger a full resync

| Event                         | Description                 |
| ----------------------------- | --------------------------- |
| `INITIAL_PURCHASE`            | New purchase                |
| `RENEWAL`                     | Subscription renewed        |
| `CANCELLATION`                | Subscription cancelled      |
| `UNCANCELLATION`              | Cancellation reversed       |
| `EXPIRATION`                  | Subscription expired        |
| `BILLING_ISSUE`               | Payment failed              |
| `SUBSCRIPTION_EXTENDED`       | Subscription extended       |
| `SUBSCRIPTION_PAUSED`         | Subscription paused         |
| `PRODUCT_CHANGE`              | Product changed             |
| `NON_RENEWING_PURCHASE`       | One-time purchase           |
| `TEMPORARY_ENTITLEMENT_GRANT` | Temporary grant             |
| `REFUND`                      | Purchase refunded           |
| `REFUND_REVERSED`             | Refund reversed (App Store) |

### Events that trigger a virtual currency balance sync

| Event                          | Description                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `VIRTUAL_CURRENCY_TRANSACTION` | Currency granted or adjusted via purchase (requires `REVENUECAT_PROJECT_ID`) |

### Events with special handling

| Event                   | Action                        |
| ----------------------- | ----------------------------- |
| `TRANSFER`              | Resyncs both old and new user |
| `TEST`                  | Logged, no sync               |
| `SUBSCRIBER_ALIAS`      | Logged, no sync               |
| `INVOICE_ISSUANCE`      | Logged, no sync               |
| `EXPERIMENT_ENROLLMENT` | Logged, no sync               |

## Database Schema

The component creates these tables in its own namespace:

### subscribers

| Field           | Type   | Description                              |
| --------------- | ------ | ---------------------------------------- |
| `appUserId`     | string | RevenueCat app_user_id                   |
| `lastSyncedAt`  | number | Timestamp of last sync                   |
| `rawSubscriber` | any    | Full raw customer JSON from RevenueCat v2 API |

### entitlements

| Field             | Type    | Description                                                          |
| ----------------- | ------- | -------------------------------------------------------------------- |
| `appUserId`       | string  | RevenueCat app_user_id                                               |
| `entitlementId`   | string  | Entitlement lookup key (e.g., "premium"), resolved from v2 API       |
| `isActive`        | boolean | Whether the entitlement is currently active                          |
| `expiresDate`     | string? | Expiration date as ISO string (undefined = lifetime)                 |
| `lastSyncedAt`    | number  | Timestamp of last sync                                               |

### virtual_currency_balances

| Field          | Type   | Description                         |
| -------------- | ------ | ----------------------------------- |
| `appUserId`    | string | RevenueCat app_user_id              |
| `currencyCode` | string | Virtual currency code (e.g., "GLD") |
| `balance`      | number | Current balance (0–2,000,000,000)   |
| `lastSyncedAt` | number | Timestamp of last sync              |

### webhook_events

| Field               | Type    | Description          |
| ------------------- | ------- | -------------------- |
| `revenuecatEventId` | string  | RevenueCat event ID  |
| `eventType`         | string  | Event type           |
| `eventTimestampMs`  | number  | Event timestamp      |
| `processedAt`       | number  | When we processed it |
| `status`            | string? | Processing status    |

## User ID Mapping

The `getAppUserId()` function in your `convex/revenuecat.ts` maps your auth provider's user ID to a RevenueCat `app_user_id`. This must be consistent across:

1. **Your mobile app** — when configuring RevenueCat SDK: `Purchases.configure({ apiKey, appUserID })`
2. **Your web checkout** — when creating Paddle transactions: `custom_data: { userId: appUserId }`
3. **Your Convex backend** — the `getAppUserId()` function

### Examples by auth provider

**Clerk:**

```typescript
function getAppUserId(identity: { subject: string }): string {
  return identity.subject; // e.g., "user_2N..."
}
```

**Custom / Token Identifier:**

```typescript
function getAppUserId(identity: { tokenIdentifier: string }): string {
  return identity.tokenIdentifier;
}
```

## Post-Purchase Polling

After a web Paddle checkout, the purchase flows through:

1. Paddle processes payment
2. Paddle sends webhook to RevenueCat (takes a few seconds)
3. RevenueCat updates subscriber entitlements

The `pollForEntitlement` method handles this delay:

```typescript
const result = await rcClient.pollForEntitlement(ctx, {
  appUserId: "user_123",
  entitlementId: "premium",
  maxAttempts: 15, // default: 10
  intervalMs: 2000, // default: 3000
});

if (result.found) {
  console.log(`Entitlement found after ${result.attempts} attempts`);
}
```

Each poll iteration syncs the full subscriber state to Convex, so reactive queries update the UI as soon as the entitlement appears.

## Virtual Currency

The component supports [RevenueCat Virtual Currency](https://www.revenuecat.com/docs/offerings/virtual-currency) via the v2 REST API.

### Syncing balances

Balances are automatically synced on `VIRTUAL_CURRENCY_TRANSACTION` webhook events (fired on purchases and dashboard adjustments). You can also trigger a manual sync:

```typescript
await rcClient.syncVirtualCurrencyBalances(ctx, {
  appUserId: "user_123",
});
```

### Spending currency

API-based spend transactions don't fire webhooks, so the component syncs the updated balances from the API response directly:

```typescript
const result = await rcClient.spendVirtualCurrency(ctx, {
  appUserId: "user_123",
  adjustments: { GLD: 20, SLV: 10 }, // amounts to spend (positive numbers)
  idempotencyKey: "unique-tx-id", // optional, prevents double-spending
});
// result.balances contains updated balances
```

### Querying balances (reactive)

```typescript
// All balances
const balances = await ctx.runQuery(components.revenuecat.public.getVirtualCurrencyBalances, { appUserId: "user_123" });

// Single currency
const gold = await ctx.runQuery(components.revenuecat.public.getVirtualCurrencyBalance, { appUserId: "user_123", currencyCode: "GLD" });
```

## Example App

The [`example/`](./example) directory contains a full working app that demonstrates this component alongside [`@flyweightdev/convex-paddle`](https://github.com/flyweightdev/convex-paddle) for web checkout.

```bash
git clone https://github.com/flyweightdev/convex-revenuecat
cd convex-revenuecat
npm install

# First-time setup: create .env.local with your VITE_CONVEX_URL, then:
npx convex dev --once          # creates Convex deployment + generates types
npm run build                  # compile TypeScript (needs _generated types)

# Start development
npm run dev
```

> **Note:** The `predev` script automates this for subsequent runs, but the first time you must have `.env.local` configured before `npm run dev` will work.

The example includes:

- One-time payment checkout with Paddle.js (via `@flyweightdev/convex-paddle`)
- Subscription checkout with Paddle.js (via `@flyweightdev/convex-paddle`)
- Live pricing from Paddle API with USD/EUR currency toggle
- Entitlement-based access control via RevenueCat
- Post-checkout polling with activation indicator
- Manual "Sync Now" button
- Entitlements table view
- Authentication via Clerk

### Example Environment Variables

**`.env.local`** (client-side, Vite):

```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_PADDLE_CLIENT_TOKEN=test_...
VITE_PADDLE_SANDBOX=true
VITE_PADDLE_SINGLE_PRICE_ID=pri_...
VITE_PADDLE_SUBSCRIPTION_PRICE_ID=pri_...
VITE_REVENUECAT_ENTITLEMENT_ID=premium
```

**Convex Dashboard** (server-side):

```bash
REVENUECAT_API_KEY=sk_...                    # RevenueCat secret API key
REVENUECAT_WEBHOOK_AUTH_KEY=whsec_...        # Auth key for RC webhook verification
REVENUECAT_PROJECT_ID=proj_...               # RevenueCat project ID (required for all v2 API calls)
PADDLE_API_KEY=pdl_sbox_...                  # Paddle API key (example app only)
PADDLE_SANDBOX=true                          # Use Paddle sandbox (example app only)
CLERK_JWT_ISSUER_DOMAIN=https://verb-noun-00.clerk.accounts.dev
```

> **Note:** `PADDLE_API_KEY` and `PADDLE_SANDBOX` are only needed for the example app which uses `@flyweightdev/convex-paddle` for web checkout. Paddle webhooks go directly to RevenueCat — no `PADDLE_WEBHOOK_SECRET` is needed. The core component requires `REVENUECAT_API_KEY`, `REVENUECAT_WEBHOOK_AUTH_KEY`, and `REVENUECAT_PROJECT_ID`.

## Troubleshooting

### Entitlements not appearing after purchase

1. Verify Paddle is configured to send webhooks to RevenueCat (not to your app)
2. Check that RevenueCat webhook is pointing to `https://<deployment>.convex.site/revenuecat/webhook`
3. Ensure `REVENUECAT_WEBHOOK_AUTH_KEY` matches the auth header in RevenueCat webhook settings
4. Check that `REVENUECAT_API_KEY` is set for the resync to work

### Polling times out

Paddle → RevenueCat webhook delivery can take up to 30 seconds. Increase `maxAttempts` or `intervalMs`:

```typescript
await rcClient.pollForEntitlement(ctx, {
  appUserId,
  entitlementId: "premium",
  maxAttempts: 20,
  intervalMs: 3000,
});
```

### User ID mismatch

The `app_user_id` in RevenueCat must match what `getAppUserId()` returns. Check:

- Your mobile app's RevenueCat SDK configuration
- The `custom_data.userId` in Paddle checkout transactions
- Your `getAppUserId()` mapping function

### "Not authenticated" errors

Ensure your auth provider is configured:

1. Create `convex/auth.config.ts` with your JWT provider config
2. Set the required environment variables (`CLERK_JWT_ISSUER_DOMAIN`, etc.)
3. Run `npx convex dev` to push the config
4. Verify the user is signed in before calling actions

### Duplicate webhook events

The component includes built-in idempotency via the `webhook_events` table. Each event ID is tracked with a processing lock and TTL, and duplicate events are automatically skipped.

## License

Apache-2.0
