import type {
  HttpRouter,
  GenericActionCtx,
  GenericMutationCtx,
  GenericDataModel,
  GenericQueryCtx,
} from "convex/server";

export type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
export type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;
export type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;

// ============================================================================
// RevenueCat Webhook Event Types
// ============================================================================

/**
 * All RevenueCat webhook event types.
 * @see https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */
export type RevenueCatEventType =
  | "TEST"
  | "INITIAL_PURCHASE"
  | "NON_RENEWING_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "BILLING_ISSUE"
  | "SUBSCRIBER_ALIAS"
  | "SUBSCRIPTION_PAUSED"
  | "SUBSCRIPTION_EXTENDED"
  | "EXPIRATION"
  | "TRANSFER"
  | "TEMPORARY_ENTITLEMENT_GRANT"
  | "REFUND"
  | "REFUND_REVERSED"
  | "INVOICE_ISSUANCE"
  | "VIRTUAL_CURRENCY_TRANSACTION"
  | "EXPERIMENT_ENROLLMENT";

/**
 * The shape of a RevenueCat webhook event.
 */
export interface RevenueCatWebhookEvent {
  id: string;
  type: RevenueCatEventType;
  app_id: string;
  event_timestamp_ms: number;
  app_user_id: string;
  original_app_user_id: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[];
  period_type?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  environment?: string;
  store?: string;
  is_family_share?: boolean;
  country_code?: string;
  currency?: string;
  price?: number;
  price_in_purchased_currency?: number;
  tax_percentage?: number;
  commission_percentage?: number;
  offer_code?: string;
  takehome_percentage?: number;
  subscriber_attributes?: Record<string, { value: string; updated_at_ms: number }>;
  transaction_id?: string;
  original_transaction_id?: string;
  // Transfer-specific fields
  transferred_from?: string[];
  transferred_to?: string[];
  // Virtual currency fields
  adjustments?: Array<{
    amount: number;
    currency: {
      code: string;
      name: string;
      description?: string;
    };
  }>;
  virtual_currency_transaction_id?: string;
  source?: string;
}

/**
 * The shape of a RevenueCat webhook notification payload.
 */
export interface RevenueCatWebhookPayload {
  api_version: string;
  event: RevenueCatWebhookEvent;
}

/**
 * Parsed entitlement data for storage.
 *
 * The `entitlementId` is the entitlement's lookup key (e.g., "premium"),
 * resolved from the RevenueCat v2 API entitlement definitions.
 */
export interface EntitlementData {
  entitlementId: string;
  isActive: boolean;
  expiresDate?: string;
}

/**
 * Handler function for a specific RevenueCat webhook event.
 */
export type RevenueCatEventHandler<
  T extends RevenueCatEventType = RevenueCatEventType,
> = (
  ctx: GenericActionCtx<GenericDataModel>,
  event: RevenueCatWebhookEvent & { type: T },
) => Promise<void>;

/**
 * Map of event types to their handlers.
 */
export type RevenueCatEventHandlers = {
  [K in RevenueCatEventType]?: RevenueCatEventHandler<K>;
};

/**
 * Virtual currency balance data for storage.
 */
export interface VirtualCurrencyBalanceData {
  currencyCode: string;
  balance: number;
}

/**
 * Configuration for webhook registration.
 */
export type RegisterRoutesConfig = {
  /** Optional webhook path. Defaults to "/revenuecat/webhook" */
  webhookPath?: string;

  /** Optional event handlers that run after default processing. */
  events?: RevenueCatEventHandlers;

  /** Optional generic event handler that runs for all events. */
  onEvent?: RevenueCatEventHandler;

  /**
   * RevenueCat webhook authorization key.
   * Compared against the Authorization header on incoming webhooks.
   * Defaults to process.env.REVENUECAT_WEBHOOK_AUTH_KEY
   */
  REVENUECAT_WEBHOOK_AUTH_KEY?: string;

  /**
   * RevenueCat secret API key for REST API calls.
   * Defaults to process.env.REVENUECAT_API_KEY
   */
  REVENUECAT_API_KEY?: string;

  /**
   * RevenueCat project ID for REST API v2 calls.
   * Required for all API operations (entitlement sync, virtual currency, etc.).
   * Defaults to process.env.REVENUECAT_PROJECT_ID
   */
  REVENUECAT_PROJECT_ID?: string;
};

export type { HttpRouter };
