import { v } from "convex/values";

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
export function getAppUserId(identity: { subject: string }): string {
  return identity.subject;
}

export const entitlementDataValidator = v.object({
  entitlementId: v.string(),
  isActive: v.boolean(),
  expiresDate: v.optional(v.string()),
});

export const entitlementDocValidator = v.object({
  appUserId: v.string(),
  entitlementId: v.string(),
  isActive: v.boolean(),
  expiresDate: v.optional(v.string()),
  lastSyncedAt: v.number(),
});

export const subscriberDocValidator = v.object({
  appUserId: v.string(),
  lastSyncedAt: v.number(),
  rawSubscriber: v.optional(v.any()),
});
