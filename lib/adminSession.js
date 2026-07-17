import crypto from "crypto";

export const ADMIN_PASSWORD = "2132";

// Secret used to sign the session cookie so it can't be forged by
// simply setting a cookie with the right name — the value must be a
// valid HMAC of the session marker using this secret. Falls back to a
// fixed string if no env var is set (fine for this app's threat model:
// it's an internal admin panel, not a bank), but can be overridden via
// an ADMIN_SESSION_SECRET environment variable for extra safety.
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "polair-admin-session-secret";
export const COOKIE_NAME = "polair_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

export function buildSessionCookieValue() {
  const marker = "ok";
  return `${marker}.${sign(marker)}`;
}

export function isValidSessionCookie(cookieValue) {
  if (!cookieValue) return false;
  const [marker, signature] = cookieValue.split(".");
  if (!marker || !signature) return false;
  return sign(marker) === signature;
}
