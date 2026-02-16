/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<
  Name extends string | undefined = string | undefined,
> = {
  private: {
    checkAndRecordEvent: FunctionReference<
      "mutation",
      "internal",
      {
        revenuecatEventId: string;
        eventType: string;
        eventTimestampMs: number;
      },
      "acquired" | "processing" | "processed",
      Name
    >;
    clearEntitlements: FunctionReference<
      "mutation",
      "internal",
      { appUserId: string },
      null,
      Name
    >;
    markEventProcessed: FunctionReference<
      "mutation",
      "internal",
      { revenuecatEventId: string },
      null,
      Name
    >;
    syncSubscriberAndEntitlements: FunctionReference<
      "mutation",
      "internal",
      {
        appUserId: string;
        lastSyncedAt: number;
        rawSubscriber?: any;
        entitlements: Array<{
          entitlementId: string;
          isActive: boolean;
          productIdentifier?: string;
          expiresDate?: string;
          gracePeriodExpiresDate?: string;
          purchaseDate?: string;
          originalPurchaseDate?: string;
          store?: string;
          isSandbox?: boolean;
        }>;
      },
      null,
      Name
    >;
    syncVirtualCurrencyBalances: FunctionReference<
      "mutation",
      "internal",
      {
        appUserId: string;
        lastSyncedAt: number;
        balances: Array<{ currencyCode: string; balance: number }>;
      },
      null,
      Name
    >;
    unreserveEvent: FunctionReference<
      "mutation",
      "internal",
      { revenuecatEventId: string },
      null,
      Name
    >;
  };
  public: {
    getActiveEntitlements: FunctionReference<
      "query",
      "internal",
      { appUserId: string },
      Array<{
        appUserId: string;
        entitlementId: string;
        isActive: boolean;
        productIdentifier?: string;
        expiresDate?: string;
        gracePeriodExpiresDate?: string;
        purchaseDate?: string;
        originalPurchaseDate?: string;
        store?: string;
        isSandbox?: boolean;
        lastSyncedAt: number;
      }>,
      Name
    >;
    getEntitlement: FunctionReference<
      "query",
      "internal",
      { appUserId: string; entitlementId: string },
      {
        appUserId: string;
        entitlementId: string;
        isActive: boolean;
        productIdentifier?: string;
        expiresDate?: string;
        gracePeriodExpiresDate?: string;
        purchaseDate?: string;
        originalPurchaseDate?: string;
        store?: string;
        isSandbox?: boolean;
        lastSyncedAt: number;
      } | null,
      Name
    >;
    getEntitlements: FunctionReference<
      "query",
      "internal",
      { appUserId: string },
      Array<{
        appUserId: string;
        entitlementId: string;
        isActive: boolean;
        productIdentifier?: string;
        expiresDate?: string;
        gracePeriodExpiresDate?: string;
        purchaseDate?: string;
        originalPurchaseDate?: string;
        store?: string;
        isSandbox?: boolean;
        lastSyncedAt: number;
      }>,
      Name
    >;
    getSubscriber: FunctionReference<
      "query",
      "internal",
      { appUserId: string },
      {
        appUserId: string;
        lastSyncedAt: number;
        rawSubscriber?: any;
      } | null,
      Name
    >;
    getVirtualCurrencyBalance: FunctionReference<
      "query",
      "internal",
      { appUserId: string; currencyCode: string },
      {
        appUserId: string;
        currencyCode: string;
        balance: number;
        lastSyncedAt: number;
      } | null,
      Name
    >;
    getVirtualCurrencyBalances: FunctionReference<
      "query",
      "internal",
      { appUserId: string },
      Array<{
        appUserId: string;
        currencyCode: string;
        balance: number;
        lastSyncedAt: number;
      }>,
      Name
    >;
    hasActiveEntitlement: FunctionReference<
      "query",
      "internal",
      { appUserId: string; entitlementId: string },
      boolean,
      Name
    >;
  };
};
