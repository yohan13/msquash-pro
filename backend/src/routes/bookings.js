import { Router } from "express";
import jwt from "jsonwebtoken";
import { selectOne, selectAll, run, saveDb, uid } from "../db.js";
import { auth } from "../middleware/auth.js";
import { config } from "../config.js";

const router = Router();

function isValidDateStr(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }
function isValidTimeStr(t) { return /^\d{2}:\d{2}$/.test(t); }

function withinWindow(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date + "T00:00:00");
  const diffDays = Math.round((d - today) / 86400000);
  return diffDays >= 0 && diffDays <= config.MAX_DAYS_AHEAD;
}

function countFutureBookings(userId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return selectOne(
    "SELECT COUNT(*) as c FROM bookings WHERE user_id = ? AND date >= ?",
    [userId, todayStr]
  )?.c || 0;
}

function hasBookingSameTimeslot(userId, date, time) {
  return !!selectOne(
    "SELECT 1 FROM bookings WHERE user_id = ? AND date = ? AND time = ?",
    [userId, date, time]
  );
}

// GET /api/config
router.get("/config", (req, res) => {
  const courts = selectAll("SELECT id, name FROM courts ORDER BY id");
  res.json({
    clubName:    config.CLUB_NAME,
    dayStart:    config.DAY_START,
    dayEnd:      config.DAY_END,
    slotMinutes: config.SLOT_MINUTES,
    courts,
    rules: {
      MAX_FUTURE_BOOKINGS: config.MAX_FUTURE_BOOKINGS,
      MAX_DAYS_AHEAD:      config.MAX_DAYS_AHEAD,
      UNIQUE_PER_TIMESLOT: config.UNIQUE_PER_TIMESLOT,
    },
  });
});

// GET /api/slots?date=YYYY-MM-DD
router.get("/slots", (req, res) => {
  const { date } = req.query;
  if (!date || !isValidDateStr(String(date)))
    return res.status(400).json({ error: "INVALID_DATE" });

  const bookings = selectAll(
    `SELECT b.*, u.name as user_name, u.email as user_email
     FROM bookings b JOIN users u ON u.id = b.user_id
     WHERE date = ? ORDER BY time, court_id`,
    [String(date)]
  );
  const blocks = selectAll(
    "SELECT * FROM blocks WHERE date = ? ORDER BY time, court_id",
    [String(date)]
  );
  res.json({ bookings, blocks });
});

// GET /api/my/bookings
router.get("/my/bookings", auth, (req, res) => {
  const rows = selectAll(
    "SELECT * FROM bookings WHERE user_id = ? ORDER BY date, time",
    [req.user.sub]
  );
  res.json({ bookings: rows });
});

// POST /api/bookings
router.post("/bookings", auth, (req, res) => {
  const { date, time, courtId, note } = req.body || {};

  if (!date || !isValidDateStr(date))
    return res.status(400).json({ error: "INVALID_DATE" });
  if (!time || !isValidTimeStr(time))
    return res.status(400).json({ error: "INVALID_TIME" });
  if (!courtId || isNaN(parseInt(courtId)))
    return res.status(400).json({ error: "INVALID_COURT" });
  if (!withinWindow(date))
    return res.status(403).json({ error: "OUT_OF_WINDOW" });
  if (selectOne("SELECT 1 FROM bookings WHERE date = ? AND time = ? AND court_id = ?", [date, time, courtId]))
    return res.status(409).json({ error: "ALREADY_BOOKED" });
  if (selectOne("SELECT 1 FROM blocks WHERE date = ? AND time = ? AND court_id = ?", [date, time, courtId]))
    return res.status(409).json({ error: "SLOT_BLOCKED" });
  if (config.UNIQUE_PER_TIMESLOT && hasBookingSameTimeslot(req.user.sub, date, time))
    return res.status(409).json({ error: "USER_ALREADY_BOOKED_THIS_TIMESLOT" });

  const current = countFutureBookings(req.user.sub);
  if (current >= config.MAX_FUTURE_BOOKINGS)
    return res.status(403).json({ error: "BOOKING_LIMIT_REACHED" });

  const id = uid("b");
  run(
    "INSERT INTO bookings (id, date, time, court_id, user_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, date, time, courtId, req.user.sub, note || null, new Date().toISOString()]
  );
  saveDb();

  const booking = selectOne(
    `SELECT b.*, u.name as user_name, u.email as user_email
     FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.id = ?`,
    [id]
  );
  res.status(201).json({ booking });
});

// DELETE /api/bookings/:id
router.delete("/bookings/:id", auth, (req, res) => {
  const { id } = req.params;
  const b = selectOne("SELECT * FROM bookings WHERE id = ?", [id]);
  if (!b) return res.status(404).json({ error: "NOT_FOUND" });

  const isOwner = b.user_id === req.user.sub;
  const isAdmin = req.user.role === "ADMIN";
  if (!isOwner && !isAdmin)
    return res.status(403).json({ error: "FORBIDDEN" });

  run("DELETE FROM bookings WHERE id = ?", [id]);
  saveDb();
  res.json({ ok: true });
});

// GET /api/bookings/:id/ics  (accepts token via query string for direct browser downloads)
router.get("/bookings/:id/ics", (req, res) => {
  const rawToken = (req.headers.authorization || '').replace(/^bearer\s+/i, '') || req.query.token
  if (!rawToken) return res.status(401).send("UNAUTHORIZED")
  try {
    req.user = jwt.verify(rawToken, config.JWT_SECRET)
  } catch { return res.status(401).send("INVALID_TOKEN") }

  const b = selectOne(
    `SELECT b.*, u.name as user_name, u.email as user_email
     FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.id = ?`,
    [req.params.id]
  );
  if (!b) return res.status(404).send("NOT_FOUND");

  const [h, m] = b.time.split(":").map((x) => parseInt(x, 10));
  const [Y, Mo, Da] = b.date.split("-").map((x) => parseInt(x, 10));
  const start = new Date(Date.UTC(Y, Mo - 1, Da, h, m, 0));
  const end = new Date(start.getTime() + config.SLOT_MINUTES * 60000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const court = selectOne("SELECT name FROM courts WHERE id = ?", [b.court_id]);
  const courtName = court?.name || `Court ${b.court_id}`;

  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    `PRODID:-//${config.CLUB_NAME}//Booking//FR`,
    "BEGIN:VEVENT",
    `UID:${b.id}@msquash`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Squash - ${courtName}`,
    `DESCRIPTION:Réservation par ${b.user_name}${b.note ? "\\nNote: " + b.note.replace(/\n/g, " ") : ""}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="booking_${b.id}.ics"`);
  res.send(ics);
});

export default router;
