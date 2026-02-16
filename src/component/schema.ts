import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  subscribers: defineTable({
    appUserId: v.string(),
    lastSyncedAt: v.number(),
    rawSubscriber: v.optional(v.any()),
  }).index("by_app_user_id", ["appUserId"]),

  entitlements: defineTable({
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
  })
    .index("by_app_user_id", ["appUserId"])
    .index("by_app_user_id_and_entitlement", ["appUserId", "entitlementId"])
    .index("by_app_user_id_and_active", ["appUserId", "isActive"]),

  virtual_currency_balances: defineTable({
    appUserId: v.string(),
    currencyCode: v.string(),
    balance: v.number(),
    lastSyncedAt: v.number(),
  })
    .index("by_app_user_id", ["appUserId"])
    .index("by_app_user_id_and_currency", ["appUserId", "currencyCode"]),

  webhook_events: defineTable({
    revenuecatEventId: v.string(),
    eventType: v.string(),
    eventTimestampMs: v.number(),
    processedAt: v.number(),
    status: v.optional(
      v.union(
        v.literal("processing"),
        v.literal("processed"),
        v.literal("processed_pending"),
      ),
    ),
  }).index("by_revenuecat_event_id", ["revenuecatEventId"]),
});
