import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  try {
    req.user = jwt.verify(h.slice(7), config.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.role === "ADMIN") return next();
  return res.status(403).json({ error: "ADMIN_ONLY" });
}

export function issueToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
}
