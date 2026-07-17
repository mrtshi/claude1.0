import {
  ADMIN_PASSWORD,
  COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  buildSessionCookieValue,
} from "../../../lib/adminSession";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body || {};

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Неверный пароль" });
  }

  const cookieValue = buildSessionCookieValue();
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );

  return res.status(200).json({ success: true });
}
