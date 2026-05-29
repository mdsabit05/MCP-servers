import type { Request } from "express";

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

/**
 * Given a request and the auth instance, validate the session token
 * and return the user id, or null if invalid/missing.
 */
export async function getUserIdFromRequest(
  req: Request,
  auth: { api: { getSession: (opts: { headers: Headers }) => Promise<{ user: { id: string } } | null> } }
): Promise<string | null> {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return null;

  // better-auth expects standard Web API Headers
  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);
  // Also forward cookie if present (browser flow)
  if (req.headers.cookie) {
    headers.set("cookie", req.headers.cookie);
  }

  try {
    const session = await auth.api.getSession({ headers });
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}
