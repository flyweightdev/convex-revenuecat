"use node";

import { action, query } from "./_generated/server";
import { components } from "./_generated/api";
import { RevenueCatSync } from "@flyweightdev/convex-revenuecat";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

const rcClient = new RevenueCatSync(components.revenuecat);

// ============================================================================
// USER ID MAPPING
// ============================================================================

/**
 * Map your auth identity to a RevenueCat app_user_id.
 *
 * Customize this for your auth provider:
 * - Clerk:   identity.subject
 * - Auth0:   identity.subject
 * - Custom:  identity.tokenIdentifier
 *
 * The returned value must match the app_user_id you use when configuring
 * RevenueCat in your mobile app and when creating Paddle checkouts.
 */
function getAppUserId(identity: { subject: string }): string {
  return identity.subject;
}

// ============================================================================
// SHARED VALIDATORS
// ============================================================================

const entitlementDataValidator = v.object({
  entitlementId: v.string(),
  isActive: v.boolean(),
  productIdentifier: v.optional(v.string()),
  expiresDate: v.optional(v.string()),
  gracePeriodExpiresDate: v.optional(v.string()),
  purchaseDate: v.optional(v.string()),
  originalPurchaseDate: v.optional(v.string()),
  store: v.optional(v.string()),
  isSandbox: v.optional(v.boolean()),
});

const entitlementDocValidator = v.object({
  appUserId: v.string(),
  entitlementId: v.string(),
  isActive: v.boolean(),
  productIdentifier: v.optional(v.string()),
  expiresDate: v.optional(v.string()),
  gracePeriodExpiresDate: v.optional(v.string()),
  purchaseDate: v.optional(v.string()),
  originalPurchaseDate: v.optional(v.string()),
  store: v.optional(v.string()),
  isSandbox: v.optional(v.boolean()),
  lastSyncedAt: v.number(),
});

const subscriberDocValidator = v.object({
  appUserId: v.string(),
  lastSyncedAt: v.number(),
  rawSubscriber: v.optional(v.any()),
});

// ============================================================================
// ENTITLEMENT SYNC
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

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get active entitlements for the current user (reactive).
 */
export const getMyEntitlements = query({
  args: {},
  returns: v.array(entitlementDocValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(
      components.revenuecat.public.getActiveEntitlements,
      { appUserId: getAppUserId(identity) },
    );
  },
});

/**
 * Check if the current user has a specific active entitlement (reactive).
 */
export const hasEntitlement = query({
  args: { entitlementId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    return await ctx.runQuery(
      components.revenuecat.public.hasActiveEntitlement,
      {
        appUserId: getAppUserId(identity),
        entitlementId: args.entitlementId,
      },
    );
  },
});

/**
 * Get all entitlements for the current user (active and inactive).
 */
export const getAllEntitlements = query({
  args: {},
  returns: v.array(entitlementDocValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(
      components.revenuecat.public.getEntitlements,
      { appUserId: getAppUserId(identity) },
    );
  },
});

/**
 * Get cached subscriber record for the current user.
 */
export const getMySubscriber = query({
  args: {},
  returns: v.union(subscriberDocValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.runQuery(
      components.revenuecat.public.getSubscriber,
      { appUserId: getAppUserId(identity) },
    );
  },
});
