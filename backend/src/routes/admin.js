import { Router } from "express";
import bcrypt from "bcryptjs";
import { selectOne, selectAll, run, saveDb, uid } from "../db.js";
import { auth, adminOnly } from "../middleware/auth.js";

const router = Router();
router.use(auth, adminOnly);

function isValidDateStr(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }
function isValidTimeStr(t) { return /^\d{2}:\d{2}$/.test(t); }

// ─── Blocks ───────────────────────────────────────────────────────────────────

// POST /api/blocks
router.post("/blocks", (req, res) => {
  const { date, time, courtId, reason } = req.body || {};
  if (!date || !isValidDateStr(date))   return res.status(400).json({ error: "INVALID_DATE" });
  if (!time || !isValidTimeStr(time))   return res.status(400).json({ error: "INVALID_TIME" });
  if (!courtId || isNaN(parseInt(courtId))) return res.status(400).json({ error: "INVALID_COURT" });

  if (selectOne("SELECT 1 FROM blocks WHERE date = ? AND time = ? AND court_id = ?", [date, time, courtId]))
    return res.status(409).json({ error: "ALREADY_BLOCKED" });
  if (selectOne("SELECT 1 FROM bookings WHERE date = ? AND time = ? AND court_id = ?", [date, time, courtId]))
    return res.status(409).json({ error: "BOOKING_EXISTS" });

  const id = uid("bl");
  run("INSERT INTO blocks (id, date, time, court_id, reason) VALUES (?, ?, ?, ?, ?)",
    [id, date, time, courtId, reason || null]);
  saveDb();
  const block = selectOne("SELECT * FROM blocks WHERE id = ?", [id]);
  res.status(201).json({ block });
});

// DELETE /api/blocks/:id
router.delete("/blocks/:id", (req, res) => {
  const bl = selectOne("SELECT * FROM blocks WHERE id = ?", [req.params.id]);
  if (!bl) return res.status(404).json({ error: "NOT_FOUND" });
  run("DELETE FROM blocks WHERE id = ?", [req.params.id]);
  saveDb();
  res.json({ ok: true });
});

// ─── Export CSV ───────────────────────────────────────────────────────────────

// GET /api/admin/export/csv?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/export/csv", (req, res) => {
  const { from, to } = req.query;

  // Validate date format if provided
  if (from && !isValidDateStr(String(from)))
    return res.status(400).json({ error: "INVALID_FROM_DATE" });
  if (to && !isValidDateStr(String(to)))
    return res.status(400).json({ error: "INVALID_TO_DATE" });

  const rows = selectAll(
    `SELECT b.date, b.time, c.name as court_name, u.name as user_name, u.email as user_email,
            b.note, b.created_at
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN courts c ON c.id = b.court_id
     WHERE (? IS NULL OR b.date >= ?) AND (? IS NULL OR b.date <= ?)
     ORDER BY b.date, b.time, b.court_id`,
    [from || null, from || null, to || null, to || null]
  );

  const escape = (v) => `"${String(v || "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
  const head = ["Date", "Heure", "Court", "Membre", "Email", "Note", "Créé le"];
  const lines = [
    "\uFEFF" + head.join(";"),
    ...rows.map((r) =>
      [r.date, r.time, r.court_name, r.user_name, r.user_email, r.note || "", r.created_at]
        .map(escape).join(";")
    ),
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="export_${from || "all"}_${to || "all"}.csv"`
  );
  res.send(lines.join("\n"));
});

// ─── User management ──────────────────────────────────────────────────────────

// GET /api/admin/users
router.get("/users", (req, res) => {
  const users = selectAll(
    `SELECT u.id, u.name, u.email, u.role, u.created_at,
            (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) as booking_count
     FROM users u ORDER BY u.created_at DESC`
  );
  res.json({ users });
});

// PATCH /api/admin/users/:id/role
router.patch("/users/:id/role", (req, res) => {
  const { role } = req.body || {};
  if (!["USER", "ADMIN"].includes(role))
    return res.status(400).json({ error: "INVALID_ROLE" });

  const u = selectOne("SELECT id FROM users WHERE id = ?", [req.params.id]);
  if (!u) return res.status(404).json({ error: "USER_NOT_FOUND" });

  // Prevent self-demotion
  if (req.params.id === req.user.sub && role !== "ADMIN")
    return res.status(403).json({ error: "CANNOT_DEMOTE_SELF" });

  run("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
  saveDb();
  res.json({ ok: true });
});

// PATCH /api/admin/users/:id/password
router.patch("/users/:id/password", (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6)
    return res.status(400).json({ error: "WEAK_PASSWORD" });

  const u = selectOne("SELECT id FROM users WHERE id = ?", [req.params.id]);
  if (!u) return res.status(404).json({ error: "USER_NOT_FOUND" });

  const hash = bcrypt.hashSync(String(newPassword), 10);
  run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.params.id]);
  saveDb();
  res.json({ ok: true });
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", (req, res) => {
  if (req.params.id === req.user.sub)
    return res.status(403).json({ error: "CANNOT_DELETE_SELF" });

  const u = selectOne("SELECT id FROM users WHERE id = ?", [req.params.id]);
  if (!u) return res.status(404).json({ error: "USER_NOT_FOUND" });

  // Delete user's bookings first
  run("DELETE FROM bookings WHERE user_id = ?", [req.params.id]);
  run("DELETE FROM users WHERE id = ?", [req.params.id]);
  saveDb();
  res.json({ ok: true });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

// GET /api/admin/stats
router.get("/stats", (req, res) => {
  const totalBookings = selectOne("SELECT COUNT(*) as c FROM bookings")?.c || 0;
  const totalUsers    = selectOne("SELECT COUNT(*) as c FROM users")?.c || 0;
  const totalBlocks   = selectOne("SELECT COUNT(*) as c FROM blocks")?.c || 0;

  const today = new Date().toISOString().slice(0, 10);
  const futureBookings = selectOne(
    "SELECT COUNT(*) as c FROM bookings WHERE date >= ?", [today]
  )?.c || 0;

  const bookingsPerCourt = selectAll(
    `SELECT c.name as court, COUNT(b.id) as count
     FROM courts c LEFT JOIN bookings b ON b.court_id = c.id
     GROUP BY c.id ORDER BY c.id`
  );

  const topUsers = selectAll(
    `SELECT u.name, u.email, COUNT(b.id) as count
     FROM users u LEFT JOIN bookings b ON b.user_id = u.id
     WHERE u.role = 'USER'
     GROUP BY u.id ORDER BY count DESC LIMIT 10`
  );

  const last30days = selectAll(
    `SELECT date, COUNT(*) as count FROM bookings
     WHERE date >= date('now', '-30 days')
     GROUP BY date ORDER BY date`
  );

  res.json({ totalBookings, totalUsers, totalBlocks, futureBookings, bookingsPerCourt, topUsers, last30days });
});

export default router;
