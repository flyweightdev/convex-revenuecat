import { cronJobs } from "convex/server";
import { components, internal } from "./_generated/api.js";
import { internalMutation } from "./_generated/server.js";

const crons = cronJobs();

crons.interval(
  "Clean up expired RevenueCat rate limits",
  { minutes: 5 },
  internal.crons.cleanupRateLimits,
);

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
