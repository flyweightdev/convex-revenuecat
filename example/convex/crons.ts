import { cronJobs } from "convex/server";
import { components } from "./_generated/api.js";
import { internalMutation } from "./_generated/server.js";

const crons = cronJobs();

// Clean up processed webhook events older than 60 days
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

crons.interval(
  "Clean up old RevenueCat webhook events",
  { hours: 24 },
  internal.crons.cleanupWebhookEvents,
);

crons.interval(
  "Clean up expired RevenueCat rate limits",
  { hours: 1 },
  internal.crons.cleanupRateLimits,
);

export const cleanupWebhookEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const deleted = await ctx.runMutation(
      components.revenuecat.private.cleanupOldWebhookEvents,
      { maxAgeMs: SIXTY_DAYS_MS },
    );
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} old RevenueCat webhook events`);
    }
  },
});

export const cleanupRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const deleted = await ctx.runMutation(
      components.revenuecat.private.cleanupRateLimits,
      {},
    );
    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} expired RevenueCat rate limit entries`);
    }
  },
});

export default crons;
