/** Helper to get the authenticated user identity or throw. */
export async function requireAuth(ctx: {
  auth: { getUserIdentity: () => Promise<any> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}
