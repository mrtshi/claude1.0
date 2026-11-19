import { ADMIN_PASSWORD, buildSessionCookieHeader } from "../../../lib/adminSession";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body || {};

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Неверный пароль" });
  }

  res.setHeader("Set-Cookie", buildSessionCookieHeader());
  return res.status(200).json({ success: true });
}
