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
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    private: {
      checkAndRecordEvent: FunctionReference<
        "mutation",
        "internal",
        {
          eventTimestampMs: number;
          eventType: string;
          revenuecatEventId: string;
        },
        "acquired" | "processing" | "processed",
        Name
      >;
      checkRateLimit: FunctionReference<
        "mutation",
        "internal",
        { key: string },
        "allowed" | "rate_limited",
        Name
      >;
      cleanupRateLimits: FunctionReference<
        "mutation",
        "internal",
        {},
        number,
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
          entitlements: Array<{
            entitlementId: string;
            expiresDate?: string;
            isActive: boolean;
          }>;
          lastSyncedAt: number;
          rawSubscriber?: any;
        },
        null,
        Name
      >;
      syncVirtualCurrencyBalances: FunctionReference<
        "mutation",
        "internal",
        {
          appUserId: string;
          balances: Array<{ balance: number; currencyCode: string }>;
          lastSyncedAt: number;
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
          expiresDate?: string;
          isActive: boolean;
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
          expiresDate?: string;
          isActive: boolean;
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
          expiresDate?: string;
          isActive: boolean;
          lastSyncedAt: number;
        }>,
        Name
      >;
      getSubscriber: FunctionReference<
        "query",
        "internal",
        { appUserId: string },
        { appUserId: string; lastSyncedAt: number; rawSubscriber?: any } | null,
        Name
      >;
      getVirtualCurrencyBalance: FunctionReference<
        "query",
        "internal",
        { appUserId: string; currencyCode: string },
        {
          appUserId: string;
          balance: number;
          currencyCode: string;
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
          balance: number;
          currencyCode: string;
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
