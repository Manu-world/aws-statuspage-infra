import jwt from "jsonwebtoken";
import { config, JWT_EXPIRES_IN } from "../config";

export type AuthTokenPayload = {
  sub: string;
  email: string;
};

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded === "string" || !decoded.sub || typeof decoded.email !== "string") {
    throw new Error("Invalid token payload");
  }
  return { sub: String(decoded.sub), email: decoded.email };
}
