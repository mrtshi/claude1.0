import { COOKIE_NAME, isValidSessionCookie } from "./adminSession";

// Parses the raw Cookie header into a { name: value } map. Next.js's
// req.cookies already does this in most cases, but we implement a
// small manual parser too so this works consistently regardless of
// how the request reaches the handler.
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  });
  return out;
}

// Returns true if the request carries a valid admin session cookie.
export function hasValidAdminSession(req) {
  const cookies = req.cookies || parseCookies(req.headers?.cookie);
  const raw = cookies[COOKIE_NAME];
  return isValidSessionCookie(raw);
}

// Convenience guard for API routes: call at the top of a handler and
// return early if it sends a response (meaning auth failed).
export function requireAdminSession(req, res) {
  if (!hasValidAdminSession(req)) {
    res.status(401).json({ error: "Требуется авторизация администратора" });
    return true; // handled (caller should return)
  }
  return false;
}
