import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { registerRoutes } from "@flyweightdev/convex-revenuecat";

const http = httpRouter();

// Register RevenueCat webhook handler
// Paddle webhooks go directly to RevenueCat — no Paddle webhook routes needed here.
registerRoutes(http, components.revenuecat, {
  webhookPath: "/revenuecat/webhook",
  events: {
    INITIAL_PURCHASE: async (ctx, event) => {
      console.log("New purchase:", event.app_user_id);
    },
    RENEWAL: async (ctx, event) => {
      console.log("Renewal:", event.app_user_id);
    },
    CANCELLATION: async (ctx, event) => {
      console.log("Cancellation:", event.app_user_id);
    },
  },
  onEvent: async (ctx, event) => {
    console.log("RevenueCat event:", event.type, event.id);
  },
});

export default http;
