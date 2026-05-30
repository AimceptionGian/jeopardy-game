export function getAdminAuthError(request: Request): string | null {
  const expectedToken = process.env.ADMIN_TOKEN?.trim();
  if (!expectedToken) {
    return "ADMIN_TOKEN is not configured.";
  }

  const headerToken = request.headers.get("x-admin-token")?.trim();
  const authHeader = request.headers.get("authorization")?.trim();
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : undefined;
  const providedToken = headerToken || bearerToken;

  if (!providedToken || providedToken !== expectedToken) {
    return "Unauthorized.";
  }

  return null;
}
