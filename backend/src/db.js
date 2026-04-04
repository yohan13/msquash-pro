import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import initSqlJs from "sql.js";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// En Docker, le volume est monté sur /app/data ; en dev, on utilise le répertoire backend/
const DB_DIR  = process.env.DB_DIR || path.join(__dirname, "..");
const DB_FILE = path.join(DB_DIR, "data.db");

const SQL = await initSqlJs({
  locateFile: (file) => path.join(__dirname, "..", "node_modules", "sql.js", "dist", file),
});

let db;
let freshDb = false;

if (fs.existsSync(DB_FILE)) {
  db = new SQL.Database(new Uint8Array(fs.readFileSync(DB_FILE)));
} else {
  db = new SQL.Database();
  freshDb = true;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

db.run(`
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'USER',
  created_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS courts (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id        TEXT PRIMARY KEY,
  date      TEXT NOT NULL,
  time      TEXT NOT NULL,
  court_id  INTEGER NOT NULL,
  user_id   TEXT NOT NULL,
  note      TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(date, time, court_id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS blocks (
  id        TEXT PRIMARY KEY,
  date      TEXT NOT NULL,
  time      TEXT NOT NULL,
  court_id  INTEGER NOT NULL,
  reason    TEXT,
  UNIQUE(date, time, court_id)
);
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function selectOne(sql, params = []) {
  const st = db.prepare(sql);
  st.bind(params);
  const row = st.step() ? st.getAsObject() : null;
  st.free();
  return row;
}

export function selectAll(sql, params = []) {
  const st = db.prepare(sql);
  st.bind(params);
  const out = [];
  while (st.step()) out.push(st.getAsObject());
  st.free();
  return out;
}

export function run(sql, params = []) {
  const st = db.prepare(sql);
  st.bind(params);
  st.step();
  st.free();
}

export function saveDb() {
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

// ─── Init courts & admin ──────────────────────────────────────────────────────

const courtCount = selectOne("SELECT COUNT(*) as c FROM courts")?.c || 0;
if (freshDb || courtCount === 0) {
  for (let i = 1; i <= config.COURTS; i++) {
    run("INSERT OR IGNORE INTO courts (id, name) VALUES (?, ?)", [i, `Court ${i}`]);
  }
}

export { db, freshDb };
