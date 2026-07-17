export const COOKIE_NAME = "statuspage_token";
export const JWT_EXPIRES_IN = "8h";

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return defaultValue;
  }
  return raw === "true" || raw === "1";
}

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "",
  cookieSecure: envFlag("COOKIE_SECURE", false),
  seedDemoData: envFlag("SEED_DEMO_DATA", true),
};

export function assertAuthConfig(): void {
  if (!config.jwtSecret) {
    if (config.nodeEnv === "production") {
      throw new Error("JWT_SECRET must be set in production");
    }
    // Allow local/test with a weak default so typecheck/dev still boot if .env missing
    process.env.JWT_SECRET = "dev-only-insecure-jwt-secret";
    config.jwtSecret = process.env.JWT_SECRET;
  }
}
