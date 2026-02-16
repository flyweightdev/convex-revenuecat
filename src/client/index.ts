import { httpActionGeneric } from "convex/server";
import type {
  ActionCtx,
  EntitlementData,
  HttpRouter,
  RegisterRoutesConfig,
  RevenueCatEventHandlers,
  RevenueCatWebhookEvent,
  RevenueCatWebhookPayload,
  VirtualCurrencyBalanceData,
} from "./types.js";
import type { ComponentApi } from "../component/_generated/component.js";

export type RevenueCatComponent = ComponentApi;

export type {
  RegisterRoutesConfig,
  RevenueCatEventHandlers,
  RevenueCatWebhookEvent,
  VirtualCurrencyBalanceData,
};

// ============================================================================
// RevenueCat Sync Client
// ============================================================================

/**
 * RevenueCat Entitlement Sync Component Client
 *
 * Provides methods for syncing RevenueCat subscriber data and entitlements
 * into your Convex database, and polling for entitlement activation after
 * web purchases.
 */
export class RevenueCatSync {
  private _apiKey: string;
  private _projectId: string;

  constructor(
    public component: RevenueCatComponent,
    options?: {
      REVENUECAT_API_KEY?: string;
      REVENUECAT_PROJECT_ID?: string;
    },
  ) {
    this._apiKey =
      options?.REVENUECAT_API_KEY ?? process.env.REVENUECAT_API_KEY ?? "";
    this._projectId =
      options?.REVENUECAT_PROJECT_ID ?? process.env.REVENUECAT_PROJECT_ID ?? "";
  }

  get apiKey() {
    if (!this._apiKey) {
      throw new Error("REVENUECAT_API_KEY environment variable is not set");
    }
    return this._apiKey;
  }

  get projectId() {
    if (!this._projectId) {
      throw new Error("REVENUECAT_PROJECT_ID environment variable is not set");
    }
    return this._projectId;
  }

  // ==========================================================================
  // SYNC ENGINE
  // ==========================================================================

  /**
   * Sync a subscriber's entitlements from RevenueCat into the Convex database.
   *
   * Fetches the subscriber from the RevenueCat REST API, parses their
   * entitlements, and writes the results to the Convex database.
   *
   * Call this on login, app load, or whenever you need fresh entitlement data.
   */
  async syncSubscriber(
    ctx: ActionCtx,
    args: { appUserId: string },
  ): Promise<{ entitlements: EntitlementData[] }> {
    const result = await fetchCustomerAndEntitlements(
      this.apiKey,
      this.projectId,
      args.appUserId,
    );

    if (!result) {
      await ctx.runMutation(this.component.private.clearEntitlements, {
        appUserId: args.appUserId,
      });
      return { entitlements: [] };
    }

    const { customer, entitlements } = result;
    const lastSyncedAt = Date.now();

    await ctx.runMutation(this.component.private.syncSubscriberAndEntitlements, {
      appUserId: args.appUserId,
      lastSyncedAt,
      rawSubscriber: customer,
      entitlements,
    });

    return { entitlements };
  }

  /**
   * Poll RevenueCat until a specific entitlement becomes active.
   *
   * Used after a web Paddle checkout completes. Paddle sends a webhook to
   * RevenueCat (takes a few seconds), so we poll until the entitlement appears.
   *
   * Each poll iteration syncs to the Convex database, so reactive queries
   * will update the UI as soon as the entitlement is found.
   */
  async pollForEntitlement(
    ctx: ActionCtx,
    args: {
      appUserId: string;
      entitlementId: string;
      maxAttempts?: number;
      intervalMs?: number;
    },
  ): Promise<{ found: boolean; attempts: number }> {
    const maxAttempts = args.maxAttempts ?? 10;
    const intervalMs = args.intervalMs ?? 3000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.syncSubscriber(ctx, {
        appUserId: args.appUserId,
      });

      const found = result.entitlements.some(
        (e) => e.entitlementId === args.entitlementId && e.isActive,
      );

      if (found) {
        return { found: true, attempts: attempt };
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return { found: false, attempts: maxAttempts };
  }

  // ==========================================================================
  // VIRTUAL CURRENCY
  // ==========================================================================

  /**
   * Fetch virtual currency balances from RevenueCat v2 API and sync to Convex.
   *
   * Requires REVENUECAT_PROJECT_ID to be set.
   */
  async syncVirtualCurrencyBalances(
    ctx: ActionCtx,
    args: { appUserId: string },
  ): Promise<{ balances: VirtualCurrencyBalanceData[] }> {
    const balances = await fetchVirtualCurrencyBalances(
      this.apiKey,
      this.projectId,
      args.appUserId,
    );
    const lastSyncedAt = Date.now();

    await ctx.runMutation(
      this.component.private.syncVirtualCurrencyBalances,
      {
        appUserId: args.appUserId,
        lastSyncedAt,
        balances,
      },
    );

    return { balances };
  }

  /**
   * Spend virtual currency via RevenueCat v2 API and sync updated balances.
   *
   * Accepts a map of currency codes to amounts to spend (positive numbers).
   * Returns the updated balances after the transaction.
   *
   * API-based transactions don't fire webhooks, so we sync the response
   * directly to keep the cache fresh.
   */
  async spendVirtualCurrency(
    ctx: ActionCtx,
    args: {
      appUserId: string;
      adjustments: Record<string, number>;
      idempotencyKey?: string;
    },
  ): Promise<{ balances: VirtualCurrencyBalanceData[] }> {
    // Negate amounts: caller passes positive spend amounts, API expects negative
    const apiAdjustments = validateSpendAdjustments(args.adjustments);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    if (args.idempotencyKey) {
      headers["Idempotency-Key"] = args.idempotencyKey;
    }

    const response = await fetch(
      `https://api.revenuecat.com/v2/projects/${encodeURIComponent(this.projectId)}/customers/${encodeURIComponent(args.appUserId)}/virtual_currencies/transactions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ adjustments: apiAdjustments }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("RevenueCat v2 API error:", errorBody);
      throw new Error(
        `Failed to spend virtual currency for ${args.appUserId}: ${response.status}`,
      );
    }

    const result = await response.json();
    const balances = parseVirtualCurrencyBalances(result);
    const lastSyncedAt = Date.now();

    await ctx.runMutation(
      this.component.private.syncVirtualCurrencyBalances,
      {
        appUserId: args.appUserId,
        lastSyncedAt,
        balances,
      },
    );

    return { balances };
  }
}

// ============================================================================
// CUSTOMER & ENTITLEMENT FETCHING (shared by syncSubscriber + fullResync)
// ============================================================================

/**
 * Fetch a customer from the RevenueCat v2 API, resolve entitlement lookup keys,
 * and handle pagination for active_entitlements.
 *
 * Returns `null` when the customer does not exist (404).
 */
async function fetchCustomerAndEntitlements(
  apiKey: string,
  projectId: string,
  appUserId: string,
  lookupMap?: Map<string, string>,
): Promise<{ customer: any; entitlements: EntitlementData[] } | null> {
  const response = await fetch(
    `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("RevenueCat API error:", errorBody);
    throw new Error(`Failed to fetch customer ${appUserId} from RevenueCat`);
  }

  const customer = await response.json();

  if (!customer || typeof customer !== "object" || customer.object !== "customer") {
    throw new Error(
      `Unexpected RevenueCat API response for customer ${appUserId}: missing customer object`,
    );
  }

  const resolvedMap = lookupMap ?? await fetchEntitlementLookupMap(apiKey, projectId);

  // Parse first page of active entitlements
  const entitlements = parseActiveEntitlements(
    customer.active_entitlements?.items,
    resolvedMap,
  );

  // Follow pagination
  let nextPage: string | null = customer.active_entitlements?.next_page ?? null;
  while (nextPage) {
    const pageResponse = await fetch(`https://api.revenuecat.com${nextPage}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!pageResponse.ok) break;
    const page = await pageResponse.json();
    entitlements.push(...parseActiveEntitlements(page.items, resolvedMap));
    nextPage = page.next_page ?? null;
  }

  return { customer, entitlements };
}

/**
 * Fetch project entitlement definitions and build an ID → lookup_key map.
 *
 * The v2 active_entitlements response uses opaque entitlement IDs (e.g.,
 * "entla1b2c3d4e5"). This helper resolves them to the human-readable
 * lookup keys (e.g., "premium") that consumers expect.
 */
async function fetchEntitlementLookupMap(
  apiKey: string,
  projectId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let url: string | null =
    `/v2/projects/${encodeURIComponent(projectId)}/entitlements?limit=200`;

  while (url) {
    const response: Response = await fetch(`https://api.revenuecat.com${url}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        "Failed to fetch entitlement definitions:",
        await response.text(),
      );
      break;
    }

    const result: any = await response.json();
    for (const item of result.items ?? []) {
      if (item.id && item.lookup_key) {
        map.set(item.id, item.lookup_key);
      }
    }
    url = result.next_page ?? null;
  }

  return map;
}

/**
 * Parse active entitlements from the RevenueCat v2 API response,
 * resolving opaque entitlement IDs to human-readable lookup keys.
 */
function parseActiveEntitlements(
  items: any[] | undefined,
  lookupMap: Map<string, string>,
): EntitlementData[] {
  if (!Array.isArray(items)) return [];

  return items.map((item) => ({
    entitlementId: lookupMap.get(item.entitlement_id) ?? item.entitlement_id,
    isActive: true,
    expiresDate: item.expires_at
      ? new Date(item.expires_at).toISOString()
      : undefined,
  }));
}

// ============================================================================
// VIRTUAL CURRENCY HELPERS
// ============================================================================

/**
 * Fetch virtual currency balances from the RevenueCat v2 API.
 */
async function fetchVirtualCurrencyBalances(
  apiKey: string,
  projectId: string,
  appUserId: string,
): Promise<VirtualCurrencyBalanceData[]> {
  const response = await fetch(
    `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(appUserId)}/virtual_currencies`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("RevenueCat v2 API error:", errorBody);
    throw new Error(
      `Failed to fetch virtual currency balances for ${appUserId}: ${response.status}`,
    );
  }

  const result = await response.json();
  return parseVirtualCurrencyBalances(result);
}

/**
 * Parse virtual currency balances from a RevenueCat v2 API response.
 */
function parseVirtualCurrencyBalances(
  result: any,
): VirtualCurrencyBalanceData[] {
  const items = result?.items;
  if (!Array.isArray(items)) return [];

  const balances: VirtualCurrencyBalanceData[] = [];
  for (const item of items) {
    if (
      item &&
      typeof item.currency_code === "string" &&
      typeof item.balance === "number" &&
      Number.isFinite(item.balance)
    ) {
      balances.push({
        currencyCode: item.currency_code,
        balance: item.balance,
      });
    }
  }
  return balances;
}

/**
 * Validate and normalize spend adjustments.
 * Caller-facing API uses positive spend amounts; RevenueCat expects negatives.
 */
function validateSpendAdjustments(
  adjustments: Record<string, number>,
): Record<string, number> {
  const entries = Object.entries(adjustments ?? {});
  if (entries.length === 0) {
    throw new Error("adjustments must include at least one currency amount");
  }

  const normalized: Record<string, number> = {};
  for (const [rawCode, amount] of entries) {
    const code = rawCode.trim();
    if (!code) {
      throw new Error("adjustments contains an empty currency code");
    }
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      throw new Error(`adjustment for ${code} must be a finite number`);
    }
    if (amount <= 0) {
      throw new Error(`adjustment for ${code} must be greater than zero`);
    }
    normalized[code] = -amount;
  }

  return normalized;
}

// ============================================================================
// WEBHOOK ROUTE REGISTRATION
// ============================================================================

/**
 * Register RevenueCat webhook routes with the HTTP router.
 *
 * Handles authorization verification, event deduplication, and automatic
 * entitlement syncing from the RevenueCat REST API.
 *
 * @example
 * ```typescript
 * // convex/http.ts
 * import { httpRouter } from "convex/server";
 * import { components } from "./_generated/api";
 * import { registerRoutes } from "@flyweightdev/convex-revenuecat";
 *
 * const http = httpRouter();
 *
 * registerRoutes(http, components.revenuecat, {
 *   events: {
 *     INITIAL_PURCHASE: async (ctx, event) => {
 *       console.log("New purchase:", event.app_user_id);
 *     },
 *   },
 * });
 *
 * export default http;
 * ```
 */
export function registerRoutes(
  http: HttpRouter,
  component: ComponentApi,
  config?: RegisterRoutesConfig,
) {
  const webhookPath = config?.webhookPath ?? "/revenuecat/webhook";
  const eventHandlers = config?.events ?? {};

  http.route({
    path: webhookPath,
    method: "POST",
    handler: httpActionGeneric(async (ctx, req) => {
      // 1. Verify webhook authorization
      const webhookAuthKey =
        config?.REVENUECAT_WEBHOOK_AUTH_KEY ||
        process.env.REVENUECAT_WEBHOOK_AUTH_KEY;

      if (!webhookAuthKey) {
        console.error("REVENUECAT_WEBHOOK_AUTH_KEY is not set");
        return new Response("Webhook auth key not configured", { status: 500 });
      }

      const authHeader = req.headers.get("authorization");
      if (!authHeader || authHeader !== `Bearer ${webhookAuthKey}`) {
        console.error("Webhook authorization failed");
        return new Response("Unauthorized", { status: 401 });
      }

      // 2. Parse body
      const body = await req.text();
      let payload: RevenueCatWebhookPayload;
      try {
        payload = JSON.parse(body);
      } catch {
        console.error("Failed to parse webhook body");
        return new Response("Invalid JSON", { status: 400 });
      }

      // 3. Validate payload shape
      const event = payload?.event;
      if (
        !event ||
        typeof event.id !== "string" ||
        typeof event.type !== "string" ||
        typeof event.event_timestamp_ms !== "number"
      ) {
        console.error("Invalid webhook payload: missing or malformed event fields");
        return new Response("Invalid webhook payload", { status: 400 });
      }

      // 4. Idempotency check (tri-state: "acquired" | "processing" | "processed")
      try {
        const lockState = await ctx.runMutation(
          component.private.checkAndRecordEvent,
          {
            revenuecatEventId: event.id,
            eventType: event.type,
            eventTimestampMs: event.event_timestamp_ms,
          },
        );

        if (lockState === "processed") {
          return new Response(
            JSON.stringify({ received: true, duplicate: true }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (lockState === "processing") {
          return new Response(
            JSON.stringify({ received: true, retry: true }),
            {
              status: 409,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "30",
              },
            },
          );
        }
      } catch (error) {
        console.error("Failed to acquire idempotency lock:", error);
        return new Response("Idempotency check failed", { status: 500 });
      }

      // 5. Process the event
      try {
        await processEvent(ctx, component, event, config);

        // Call generic event handler if provided
        if (config?.onEvent) {
          await config.onEvent(ctx, event);
        }

        // Call custom event handler if provided
        const customHandler: ((ctx: any, event: any) => Promise<void>) | undefined =
          eventHandlers[event.type] as any;
        if (customHandler) {
          await customHandler(ctx, event);
        }

        // 6. Mark as processed
        try {
          await ctx.runMutation(component.private.markEventProcessed, {
            revenuecatEventId: event.id,
          });
        } catch (markError) {
          console.error("Failed to mark event as processed:", markError);
          return new Response("Failed to finalize event", { status: 500 });
        }
      } catch (error) {
        // Release lock so RevenueCat retries can reprocess
        try {
          await ctx.runMutation(component.private.unreserveEvent, {
            revenuecatEventId: event.id,
          });
        } catch (unreserveError) {
          console.error(
            "Failed to release lock after processing failure:",
            unreserveError,
          );
        }
        console.error("Error processing webhook:", error);
        return new Response("Error processing webhook", { status: 500 });
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}

// ============================================================================
// WEBHOOK EVENT PROCESSING
// ============================================================================

/**
 * Process RevenueCat webhook events.
 *
 * For entitlement-affecting events, triggers a full resync from the
 * RevenueCat REST API rather than trying to incrementally update from
 * the webhook payload. This ensures the cached data always matches
 * RevenueCat's truth.
 */
async function processEvent(
  ctx: ActionCtx,
  component: ComponentApi,
  event: RevenueCatWebhookEvent,
  config?: RegisterRoutesConfig,
): Promise<void> {
  const apiKey =
    config?.REVENUECAT_API_KEY || process.env.REVENUECAT_API_KEY;
  const projectId =
    config?.REVENUECAT_PROJECT_ID || process.env.REVENUECAT_PROJECT_ID;
  const appUserId = event.app_user_id;

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "CANCELLATION":
    case "UNCANCELLATION":
    case "EXPIRATION":
    case "BILLING_ISSUE":
    case "SUBSCRIPTION_EXTENDED":
    case "SUBSCRIPTION_PAUSED":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
    case "TEMPORARY_ENTITLEMENT_GRANT":
    case "REFUND":
    case "REFUND_REVERSED": {
      if (!apiKey || !projectId) {
        throw new Error(
          "REVENUECAT_API_KEY and REVENUECAT_PROJECT_ID are required to process entitlement-affecting events. " +
          "Set them in the Convex dashboard environment variables.",
        );
      }
      if (!appUserId) {
        throw new Error(
          `Webhook event ${event.type} (${event.id}) is missing app_user_id`,
        );
      }
      await fullResync(ctx, component, apiKey, projectId, appUserId);
      break;
    }

    case "TRANSFER": {
      if (!apiKey || !projectId) {
        throw new Error(
          "REVENUECAT_API_KEY and REVENUECAT_PROJECT_ID are required to process TRANSFER events. " +
          "Set them in the Convex dashboard environment variables.",
        );
      }
      const userIds = new Set<string>();
      if (appUserId) userIds.add(appUserId);
      for (const id of event.transferred_from ?? []) {
        if (id) userIds.add(id);
      }
      for (const id of event.transferred_to ?? []) {
        if (id) userIds.add(id);
      }
      // Pre-fetch lookup map once for all users in this transfer
      const lookupMap = await fetchEntitlementLookupMap(apiKey, projectId);
      for (const id of userIds) {
        await fullResync(ctx, component, apiKey, projectId, id, lookupMap);
      }
      break;
    }

    case "VIRTUAL_CURRENCY_TRANSACTION": {
      if (!apiKey || !projectId) {
        throw new Error(
          "REVENUECAT_API_KEY and REVENUECAT_PROJECT_ID are required to sync virtual currency. " +
          "Set them in the Convex dashboard environment variables.",
        );
      }
      if (!appUserId) {
        throw new Error(
          `Webhook event ${event.type} (${event.id}) is missing app_user_id`,
        );
      }
      const balances = await fetchVirtualCurrencyBalances(
        apiKey,
        projectId,
        appUserId,
      );
      await ctx.runMutation(
        component.private.syncVirtualCurrencyBalances,
        {
          appUserId,
          lastSyncedAt: Date.now(),
          balances,
        },
      );
      break;
    }

    case "TEST":
    case "SUBSCRIBER_ALIAS":
    case "INVOICE_ISSUANCE":
    case "EXPERIMENT_ENROLLMENT":
      console.log(`RevenueCat event ${event.type} — no sync needed`);
      break;

    default:
      console.log(`Unhandled RevenueCat event type: ${event.type}`);
  }
}

/**
 * Full resync: fetch customer from RevenueCat v2 API and update Convex DB.
 */
async function fullResync(
  ctx: ActionCtx,
  component: ComponentApi,
  apiKey: string,
  projectId: string,
  appUserId: string,
  lookupMap?: Map<string, string>,
): Promise<void> {
  const result = await fetchCustomerAndEntitlements(
    apiKey,
    projectId,
    appUserId,
    lookupMap,
  );

  if (!result) {
    console.warn(`Customer ${appUserId} not found in RevenueCat (404), clearing entitlements`);
    await ctx.runMutation(component.private.clearEntitlements, { appUserId });
    return;
  }

  const { customer, entitlements } = result;
  const lastSyncedAt = Date.now();

  await ctx.runMutation(component.private.syncSubscriberAndEntitlements, {
    appUserId,
    lastSyncedAt,
    rawSubscriber: customer,
    entitlements,
  });
}

export default RevenueCatSync;
