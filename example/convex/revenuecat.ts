"use node";

import { action } from "./_generated/server";
import { RevenueCatSync } from "@flyweightdev/convex-revenuecat";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";
import { getAppUserId, entitlementDataValidator } from "./lib/revenuecat";

const rcClient = new RevenueCatSync(components.revenuecat);

// ============================================================================
// ENTITLEMENT SYNC (actions — require Node.js runtime)
// ============================================================================

/**
 * Sync the current user's entitlements from RevenueCat.
 * Call this on login, app load, or whenever you need fresh data.
 */
export const syncEntitlements = action({
  args: {},
  returns: v.object({ entitlements: v.array(entitlementDataValidator) }),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const appUserId = getAppUserId(identity);

    return await rcClient.syncSubscriber(ctx, { appUserId });
  },
});

/**
 * Poll RevenueCat until a specific entitlement becomes active.
 * Used after a web Paddle checkout completes — Paddle sends a webhook to
 * RevenueCat which takes a few seconds, so we poll until it appears.
 */
export const waitForEntitlement = action({
  args: {
    entitlementId: v.string(),
    maxAttempts: v.optional(v.number()),
    intervalMs: v.optional(v.number()),
  },
  returns: v.object({
    found: v.boolean(),
    attempts: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const appUserId = getAppUserId(identity);

    return await rcClient.pollForEntitlement(ctx, {
      appUserId,
      entitlementId: args.entitlementId,
      maxAttempts: args.maxAttempts,
      intervalMs: args.intervalMs,
    });
  },
});
