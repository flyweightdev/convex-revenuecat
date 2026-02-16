import { v } from "convex/values";
import { query } from "./_generated/server.js";
import schema from "./schema.js";

// ============================================================================
// VALIDATOR HELPERS
// ============================================================================

const entitlementValidator = schema.tables.entitlements.validator;
const subscriberValidator = schema.tables.subscribers.validator;
const virtualCurrencyBalanceValidator =
  schema.tables.virtual_currency_balances.validator;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Compute whether an entitlement is currently active based on expiration dates.
 * This prevents stale `isActive` values when webhooks are delayed.
 */
function computeIsActive(ent: {
  isActive: boolean;
  expiresDate?: string;
  gracePeriodExpiresDate?: string;
}): boolean {
  // If there's no expiration, trust the stored value (lifetime entitlements)
  if (!ent.expiresDate) return ent.isActive;

  const now = Date.now();
  if (new Date(ent.expiresDate).getTime() > now) return true;
  if (
    ent.gracePeriodExpiresDate &&
    new Date(ent.gracePeriodExpiresDate).getTime() > now
  ) {
    return true;
  }
  return false;
}

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get all active entitlements for a user.
 */
export const getActiveEntitlements = query({
  args: { appUserId: v.string() },
  returns: v.array(entitlementValidator),
  handler: async (ctx, args) => {
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_app_user_id_and_active", (q) =>
        q.eq("appUserId", args.appUserId).eq("isActive", true),
      )
      .collect();
    return entitlements
      .filter((ent) => computeIsActive(ent))
      .map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * Check if a user has a specific active entitlement.
 */
export const hasActiveEntitlement = query({
  args: { appUserId: v.string(), entitlementId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("by_app_user_id_and_entitlement", (q) =>
        q
          .eq("appUserId", args.appUserId)
          .eq("entitlementId", args.entitlementId),
      )
      .unique();
    if (!entitlement) return false;
    return computeIsActive(entitlement);
  },
});

/**
 * Get all entitlements for a user (active and inactive).
 */
export const getEntitlements = query({
  args: { appUserId: v.string() },
  returns: v.array(entitlementValidator),
  handler: async (ctx, args) => {
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_app_user_id", (q) =>
        q.eq("appUserId", args.appUserId),
      )
      .collect();
    return entitlements.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * Get a specific entitlement for a user.
 */
export const getEntitlement = query({
  args: { appUserId: v.string(), entitlementId: v.string() },
  returns: v.union(entitlementValidator, v.null()),
  handler: async (ctx, args) => {
    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("by_app_user_id_and_entitlement", (q) =>
        q
          .eq("appUserId", args.appUserId)
          .eq("entitlementId", args.entitlementId),
      )
      .unique();
    if (!entitlement) return null;
    const { _id, _creationTime, ...data } = entitlement;
    return data;
  },
});

/**
 * Get the cached subscriber record for a user.
 */
export const getSubscriber = query({
  args: { appUserId: v.string() },
  returns: v.union(subscriberValidator, v.null()),
  handler: async (ctx, args) => {
    const subscriber = await ctx.db
      .query("subscribers")
      .withIndex("by_app_user_id", (q) =>
        q.eq("appUserId", args.appUserId),
      )
      .unique();
    if (!subscriber) return null;
    const { _id, _creationTime, ...data } = subscriber;
    return data;
  },
});

// ============================================================================
// VIRTUAL CURRENCY QUERIES
// ============================================================================

/**
 * Get all cached virtual currency balances for a user.
 */
export const getVirtualCurrencyBalances = query({
  args: { appUserId: v.string() },
  returns: v.array(virtualCurrencyBalanceValidator),
  handler: async (ctx, args) => {
    const balances = await ctx.db
      .query("virtual_currency_balances")
      .withIndex("by_app_user_id", (q) =>
        q.eq("appUserId", args.appUserId),
      )
      .collect();
    return balances.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * Get a specific virtual currency balance for a user.
 */
export const getVirtualCurrencyBalance = query({
  args: { appUserId: v.string(), currencyCode: v.string() },
  returns: v.union(virtualCurrencyBalanceValidator, v.null()),
  handler: async (ctx, args) => {
    const balance = await ctx.db
      .query("virtual_currency_balances")
      .withIndex("by_app_user_id_and_currency", (q) =>
        q
          .eq("appUserId", args.appUserId)
          .eq("currencyCode", args.currencyCode),
      )
      .unique();
    if (!balance) return null;
    const { _id, _creationTime, ...data } = balance;
    return data;
  },
});
