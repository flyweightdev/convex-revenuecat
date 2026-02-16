import { v } from "convex/values";
import { mutation } from "./_generated/server.js";

// ============================================================================
// WEBHOOK EVENT IDEMPOTENCY
// (Same state machine as convex-paddle, adapted for RevenueCat field names)
// ============================================================================

/**
 * Max age (ms) for a "processing" lock before it's considered stale/stuck.
 * Only applies to records with status="processing". Records with
 * status="processed" (or absent, for backward compat) are permanent
 * and never expire — preventing replay attacks after TTL.
 */
const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Atomically check and reserve a webhook event for processing.
 *
 * Returns a tri-state string:
 *   "acquired"   — lock acquired, caller should process the event
 *   "processing" — another handler holds the lock, caller should retry later
 *   "processed"  — event already processed, caller should return 200
 *
 * State machine:
 *   (none) → "processing"  — lock acquired, caller should process
 *   "processing" + stale   — lock expired, re-acquire for retry
 *   "processing" + fresh   — another caller is working, return "processing"
 *   "processed" / absent   — done permanently, return "processed"
 */
export const checkAndRecordEvent = mutation({
  args: {
    revenuecatEventId: v.string(),
    eventType: v.string(),
    eventTimestampMs: v.number(),
  },
  returns: v.union(
    v.literal("acquired"),
    v.literal("processing"),
    v.literal("processed"),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhook_events")
      .withIndex("by_revenuecat_event_id", (q) =>
        q.eq("revenuecatEventId", args.revenuecatEventId),
      )
      .unique();

    if (existing) {
      const status = existing.status ?? "processed";

      if (status === "processed" || status === "processed_pending") {
        return "processed";
      }

      if (status === "processing") {
        const age = Date.now() - existing.processedAt;
        if (age > LOCK_TTL_MS) {
          await ctx.db.delete(existing._id);
        } else {
          return "processing";
        }
      }
    }

    await ctx.db.insert("webhook_events", {
      revenuecatEventId: args.revenuecatEventId,
      eventType: args.eventType,
      eventTimestampMs: args.eventTimestampMs,
      processedAt: Date.now(),
      status: "processing",
    });

    return "acquired";
  },
});

/**
 * Promote a processing lock to a permanent record.
 * Call this after successful event processing.
 */
export const markEventProcessed = mutation({
  args: {
    revenuecatEventId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhook_events")
      .withIndex("by_revenuecat_event_id", (q) =>
        q.eq("revenuecatEventId", args.revenuecatEventId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "processed",
        processedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Remove a webhook event processing lock after failure.
 * This allows RevenueCat to redeliver and retry the event.
 */
export const unreserveEvent = mutation({
  args: {
    revenuecatEventId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhook_events")
      .withIndex("by_revenuecat_event_id", (q) =>
        q.eq("revenuecatEventId", args.revenuecatEventId),
      )
      .unique();

    if (existing && existing.status === "processing") {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});

// ============================================================================
// SUBSCRIBER & ENTITLEMENT MUTATIONS
// ============================================================================

const entitlementFields = v.object({
  entitlementId: v.string(),
  isActive: v.boolean(),
  expiresDate: v.optional(v.string()),
});

/**
 * Atomically sync a subscriber record and all their entitlements.
 * Upserts the subscriber and replaces all entitlements in a single transaction.
 */
export const syncSubscriberAndEntitlements = mutation({
  args: {
    appUserId: v.string(),
    lastSyncedAt: v.number(),
    rawSubscriber: v.optional(v.any()),
    entitlements: v.array(entitlementFields),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Upsert subscriber
    const existingSub = await ctx.db
      .query("subscribers")
      .withIndex("by_app_user_id", (q) =>
        q.eq("appUserId", args.appUserId),
      )
      .unique();

    if (existingSub) {
      await ctx.db.patch(existingSub._id, {
        lastSyncedAt: args.lastSyncedAt,
        rawSubscriber: args.rawSubscriber,
      });
    } else {
      await ctx.db.insert("subscribers", {
        appUserId: args.appUserId,
        lastSyncedAt: args.lastSyncedAt,
        rawSubscriber: args.rawSubscriber,
      });
    }

    // Replace all entitlements
    const existingEnts = await ctx.db
      .query("entitlements")
      .withIndex("by_app_user_id", (q) =>
        q.eq("appUserId", args.appUserId),
      )
      .collect();

    for (const ent of existingEnts) {
      await ctx.db.delete(ent._id);
    }

    for (const ent of args.entitlements) {
      await ctx.db.insert("entitlements", {
        appUserId: args.appUserId,
        entitlementId: ent.entitlementId,
        isActive: ent.isActive,
        expiresDate: ent.expiresDate,
        lastSyncedAt: args.lastSyncedAt,
      });
    }

    return null;
  },
});

// ============================================================================
// VIRTUAL CURRENCY MUTATIONS
// ============================================================================

const virtualCurrencyBalanceFields = v.object({
  currencyCode: v.string(),
  balance: v.number(),
});

/**
 * Atomically sync virtual currency balances for a user.
 * Replaces all cached balances in a single transaction.
 */
export const syncVirtualCurrencyBalances = mutation({
  args: {
    appUserId: v.string(),
    lastSyncedAt: v.number(),
    balances: v.array(virtualCurrencyBalanceFields),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Delete existing balances
    const existing = await ctx.db
      .query("virtual_currency_balances")
      .withIndex("by_app_user_id", (q) =>
        q.eq("appUserId", args.appUserId),
      )
      .collect();

    for (const bal of existing) {
      await ctx.db.delete(bal._id);
    }

    // Insert new balances
    for (const bal of args.balances) {
      await ctx.db.insert("virtual_currency_balances", {
        appUserId: args.appUserId,
        currencyCode: bal.currencyCode,
        balance: bal.balance,
        lastSyncedAt: args.lastSyncedAt,
      });
    }

    return null;
  },
});

/**
 * Clear all entitlements for a user (e.g. when subscriber is deleted from RevenueCat).
 */
export const clearEntitlements = mutation({
  args: {
    appUserId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("entitlements")
      .withIndex("by_app_user_id", (q) =>
        q.eq("appUserId", args.appUserId),
      )
      .collect();

    for (const ent of existing) {
      await ctx.db.delete(ent._id);
    }

    return null;
  },
});
