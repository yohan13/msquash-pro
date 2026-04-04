import { Router } from "express";
import bcrypt from "bcryptjs";
import { selectOne, run, saveDb, uid } from "../db.js";
import { auth, issueToken } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/register
router.post("/register", (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !String(name).trim())
    return res.status(400).json({ error: "INVALID_NAME" });
  if (!email || !/\S+@\S+\.\S+/.test(String(email)))
    return res.status(400).json({ error: "INVALID_EMAIL" });
  if (!password || String(password).length < 6)
    return res.status(400).json({ error: "WEAK_PASSWORD" });

  const normalEmail = String(email).toLowerCase().trim();

  if (selectOne("SELECT 1 FROM users WHERE email = ?", [normalEmail]))
    return res.status(409).json({ error: "EMAIL_TAKEN" });

  const id = uid("u");
  const hash = bcrypt.hashSync(String(password), 10);
  run(
    "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'USER', ?)",
    [id, String(name).trim(), normalEmail, hash, new Date().toISOString()]
  );
  saveDb();

  const user = selectOne("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [id]);
  return res.status(201).json({ user, token: issueToken(user) });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const normalEmail = String(email || "").toLowerCase().trim();

  const u = selectOne("SELECT * FROM users WHERE email = ?", [normalEmail]);
  if (!u) return res.status(401).json({ error: "BAD_CREDENTIALS" });
  if (!bcrypt.compareSync(String(password || ""), u.password_hash))
    return res.status(401).json({ error: "BAD_CREDENTIALS" });

  const pub = { id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at };
  return res.json({ user: pub, token: issueToken(pub) });
});

// GET /api/auth/me
router.get("/me", auth, (req, res) => {
  const u = selectOne("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [req.user.sub]);
  if (!u) return res.status(404).json({ error: "USER_NOT_FOUND" });
  res.json({ user: u });
});

// PATCH /api/auth/me — update name and/or password
router.patch("/me", auth, (req, res) => {
  const { name, currentPassword, newPassword } = req.body || {};
  const u = selectOne("SELECT * FROM users WHERE id = ?", [req.user.sub]);
  if (!u) return res.status(404).json({ error: "USER_NOT_FOUND" });

  let newName = u.name;
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: "INVALID_NAME" });
    newName = String(name).trim();
  }

  let newHash = u.password_hash;
  if (newPassword !== undefined) {
    if (!currentPassword) return res.status(400).json({ error: "CURRENT_PASSWORD_REQUIRED" });
    if (!bcrypt.compareSync(String(currentPassword), u.password_hash))
      return res.status(401).json({ error: "WRONG_PASSWORD" });
    if (String(newPassword).length < 6) return res.status(400).json({ error: "WEAK_PASSWORD" });
    newHash = bcrypt.hashSync(String(newPassword), 10);
  }

  run("UPDATE users SET name = ?, password_hash = ? WHERE id = ?", [newName, newHash, u.id]);
  saveDb();

  const updated = selectOne("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [u.id]);
  res.json({ user: updated, token: issueToken(updated) });
});

export default router;
