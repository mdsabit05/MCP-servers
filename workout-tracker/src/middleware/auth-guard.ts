import type { MiddlewareHandler } from "hono";
import { auth } from "../auth.ts";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
  }
}

export const authGuard: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);

  // Validate token against better-auth session store
  const session = await auth.api.getSession({
    headers: new Headers({ cookie: `better-auth.session_token=${token}` }),
  });

  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", session.user.id);
  await next();
};
