import { Request, Response, NextFunction } from "express";
import { COOKIE_NAME } from "../config";
import { verifyAuthToken, AuthTokenPayload } from "../auth/jwt";

declare global {
  namespace Express {
    interface Request {
      admin?: AuthTokenPayload;
    }
  }
}

function extractToken(req: Request): string | undefined {
  const fromCookie = req.cookies?.[COOKIE_NAME];
  if (typeof fromCookie === "string" && fromCookie.length > 0) {
    return fromCookie;
  }
  return undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    if (req.path.startsWith("/api/") || req.originalUrl.startsWith("/api/")) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.redirect("/login");
    return;
  }

  try {
    req.admin = verifyAuthToken(token);
    next();
  } catch {
    if (req.path.startsWith("/api/") || req.originalUrl.startsWith("/api/")) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.redirect("/login");
  }
}
