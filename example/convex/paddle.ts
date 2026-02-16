"use node";

import { action } from "./_generated/server";
import { components } from "./_generated/api";
import { PaddleBilling } from "@flyweightdev/convex-paddle";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

const paddleClient = new PaddleBilling(components.paddle, {
  sandbox: process.env.PADDLE_SANDBOX === "true",
});

/** Validate that a price ID has the expected Paddle format. */
function validatePriceId(priceId: string) {
  if (!priceId.startsWith("pri_")) {
    throw new Error("Invalid price ID format");
  }
}

// ============================================================================
// CHECKOUT
// ============================================================================

/**
 * Create a checkout transaction for a subscription.
 */
export const createSubscriptionCheckout = action({
  args: {
    priceId: v.string(),
    quantity: v.optional(v.number()),
    email: v.optional(v.string()),
  },
  returns: v.object({
    transactionId: v.string(),
    checkoutUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    validatePriceId(args.priceId);
    const email = identity.email ?? args.email;
    const emailTrusted = !!identity.email;
    if (!email) throw new Error("Email required: ensure auth token includes email or pass as argument");

    const customer = await paddleClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email,
      name: identity.name,
      emailTrusted,
    });

    return await paddleClient.createTransaction(ctx, {
      items: [{ priceId: args.priceId, quantity: args.quantity ?? 1 }],
      customerId: customer.customerId,
      customData: { userId: identity.subject },
    });
  },
});

/**
 * Create a checkout transaction for a one-time payment.
 */
export const createPaymentCheckout = action({
  args: {
    priceId: v.string(),
    email: v.optional(v.string()),
  },
  returns: v.object({
    transactionId: v.string(),
    checkoutUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    validatePriceId(args.priceId);
    const email = identity.email ?? args.email;
    const emailTrusted = !!identity.email;
    if (!email) throw new Error("Email required: ensure auth token includes email or pass as argument");

    const customer = await paddleClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email,
      name: identity.name,
      emailTrusted,
    });

    return await paddleClient.createTransaction(ctx, {
      items: [{ priceId: args.priceId, quantity: 1 }],
      customerId: customer.customerId,
      customData: { userId: identity.subject, priceId: args.priceId },
    });
  },
});

// ============================================================================
// PRICING
// ============================================================================

/**
 * Fetch live pricing from Paddle's pricing preview API.
 * Returns formatted prices for the given price IDs in the requested currency.
 */
export const getPricingPreview = action({
  args: {
    priceIds: v.array(v.string()),
    currencyCode: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      priceId: v.string(),
      name: v.string(),
      description: v.string(),
      type: v.string(),
      billingCycle: v.union(
        v.object({ interval: v.string(), frequency: v.number() }),
        v.null(),
      ),
      unitPrice: v.string(),
      currencyCode: v.string(),
      formatted: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // No auth required — pricing is public information

    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "PADDLE_API_KEY environment variable is not set. " +
        "Add it to your Convex dashboard environment variables."
      );
    }

    const baseUrl =
      process.env.PADDLE_SANDBOX === "true"
        ? "https://sandbox-api.paddle.com"
        : "https://api.paddle.com";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let result: any;
    try {
      const response = await fetch(`${baseUrl}/pricing-preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: args.priceIds.map((id) => ({ price_id: id, quantity: 1 })),
          currency_code: args.currencyCode ?? "USD",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Paddle API error (pricing preview):", errorBody);
        throw new Error("Failed to fetch pricing");
      }

      result = await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
    const items = result.data?.details?.line_items ?? [];

    return items.map((item: any) => ({
      priceId: item.price.id,
      name: item.price.name ?? item.price.description ?? item.price.id,
      description: item.price.description ?? "",
      type: item.price.type,
      billingCycle: item.price.billing_cycle
        ? {
            interval: item.price.billing_cycle.interval,
            frequency: item.price.billing_cycle.frequency,
          }
        : null,
      unitPrice: item.formatted_unit_totals?.total ?? item.unit_totals?.total ?? "0",
      currencyCode: result.data?.currency_code ?? args.currencyCode ?? "USD",
      formatted: item.formatted_totals?.total ?? item.totals?.total ?? "0",
    }));
  },
});
