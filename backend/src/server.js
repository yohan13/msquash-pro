import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { selectOne, run, saveDb } from "./db.js";
import bcrypt from "bcryptjs";

import authRouter     from "./routes/auth.js";
import bookingsRouter from "./routes/bookings.js";
import adminRouter    from "./routes/admin.js";

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "1mb" }));

// Rate limiting on auth endpoints to mitigate brute-force
const authLimiter = rateLimit({
  windowMs:  15 * 60 * 1000, // 15 min
  max:       20,
  message:   { error: "TOO_MANY_REQUESTS" },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use("/api/auth/login",    authLimiter);
app.use("/api/auth/register", authLimiter);

// ─── Seed admin on first start ────────────────────────────────────────────────

const adminExists = selectOne("SELECT * FROM users WHERE email = ?", [config.ADMIN_SEED_EMAIL]);
if (!adminExists) {
  const { uid } = await import("./db.js");
  const id   = uid("u");
  const hash = bcrypt.hashSync(config.ADMIN_SEED_PASSWORD, 10);
  run(
    "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'ADMIN', ?)",
    [id, config.ADMIN_SEED_NAME, config.ADMIN_SEED_EMAIL, hash, new Date().toISOString()]
  );
  saveDb();
  console.log(`[seed] Admin créé : ${config.ADMIN_SEED_EMAIL}`);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/api/health", (req, res) => res.json({ ok: true, club: config.CLUB_NAME }));

app.use("/api/auth",     authRouter);
app.use("/api",          bookingsRouter);   // /api/config, /api/slots, /api/bookings, /api/my/bookings
app.use("/api",          adminRouter);      // /api/blocks, /api/admin/*

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error("[error]", err.message || err);
  res.status(500).json({ error: "INTERNAL_ERROR" });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

const shutdown = () => {
  try { saveDb(); } catch (e) { console.error("[shutdown] saveDb error:", e.message); }
  process.exit(0);
};
process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(config.PORT, () =>
  console.log(`✅  ${config.CLUB_NAME} API → http://localhost:${config.PORT}`)
);
