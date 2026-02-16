import { defineApp } from "convex/server";
import revenuecat from "@flyweightdev/convex-revenuecat/convex.config.js";
import paddle from "@flyweightdev/convex-paddle/convex.config.js";

const app = defineApp();
app.use(revenuecat);
app.use(paddle);

export default app;
