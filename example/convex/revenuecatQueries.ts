import { query } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";
import {
  getAppUserId,
  entitlementDocValidator,
  subscriberDocValidator,
} from "./lib/revenuecat";

// ============================================================================
// QUERIES (default Convex runtime — no "use node")
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
