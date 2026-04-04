import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = parseInt(process.env.PORT || "4000", 10);
const JWT_SECRET = process.env.JWT_SECRET || "devsecret";
const CLUB_NAME = process.env.CLUB_NAME || "M Squash";
const DAY_START = process.env.DAY_START || "08:00";
const DAY_END = process.env.DAY_END || "22:00";
const SLOT_MINUTES = parseInt(process.env.SLOT_MINUTES || "45", 10);
const COURTS = parseInt(process.env.COURTS || "4", 10);
const MAX_FUTURE_BOOKINGS = parseInt(process.env.MAX_FUTURE_BOOKINGS || "2", 10);
const MAX_DAYS_AHEAD = parseInt(process.env.MAX_DAYS_AHEAD || "14", 10);
const UNIQUE_PER_TIMESLOT = (process.env.UNIQUE_PER_TIMESLOT || "true").toLowerCase() === "true";

const ADMIN_SEED_EMAIL = process.env.ADMIN_SEED_EMAIL || "admin@club.local";
const ADMIN_SEED_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "admin1234";
const ADMIN_SEED_NAME = process.env.ADMIN_SEED_NAME || "Club Admin";

const DB_FILE = path.join(__dirname, "..", "data.db");
const SQL = await initSqlJs({ locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file) });

let db, fresh=false;
if (fs.existsSync(DB_FILE)) db = new SQL.Database(new Uint8Array(fs.readFileSync(DB_FILE)));
else { db = new SQL.Database(); fresh=true; }

function saveDb(){ fs.writeFileSync(DB_FILE, Buffer.from(db.export())); }
function uid(prefix="id"){ return `${prefix}_${Math.random().toString(36).slice(2,8)}_${Date.now().toString(36)}`; }
function isValidTimeStr(t){ return /^\d{2}:\d{2}$/.test(t); }
function isValidDateStr(d){ return /^\d{4}-\d{2}-\d{2}$/.test(d); }

function selectOne(sql, params=[]){ const st=db.prepare(sql); st.bind(params); const row=st.step()?st.getAsObject():null; st.free(); return row; }
function selectAll(sql, params=[]){ const st=db.prepare(sql); st.bind(params); const out=[]; while(st.step()) out.push(st.getAsObject()); st.free(); return out; }
function run(sql, params=[]){ const st=db.prepare(sql); st.bind(params); st.step(); st.free(); }

db.run(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'USER', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS courts ( id INTEGER PRIMARY KEY, name TEXT NOT NULL );
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, time TEXT NOT NULL,
  court_id INTEGER NOT NULL, user_id TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL,
  UNIQUE(date,time,court_id), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, time TEXT NOT NULL,
  court_id INTEGER NOT NULL, reason TEXT, UNIQUE(date,time,court_id)
);
`);

const courtCount = selectOne("SELECT COUNT(*) as c FROM courts")?.c || 0;
if (fresh || courtCount===0){ for(let i=1;i<=COURTS;i++) run("INSERT OR IGNORE INTO courts (id,name) VALUES (?,?)",[i,`Court ${i}`]); }

const adminExists = selectOne("SELECT * FROM users WHERE email = ?", [ADMIN_SEED_EMAIL]);
if (!adminExists){
  const id = uid("u"); const hash = bcrypt.hashSync(ADMIN_SEED_PASSWORD, 10);
  run("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?, 'ADMIN', ?)", [id, ADMIN_SEED_NAME, ADMIN_SEED_EMAIL, hash, new Date().toISOString()]);
}
saveDb();

function issueToken(user){ return jwt.sign({ sub:user.id, role:user.role, name:user.name, email:user.email }, JWT_SECRET, { expiresIn: "7d" }); }
function auth(req,res,next){
  const h=req.headers.authorization; if(!h||!h.toLowerCase().startsWith("bearer ")) return res.status(401).json({error:"UNAUTHORIZED"});
  try{ req.user=jwt.verify(h.slice(7), JWT_SECRET); next(); }catch{ return res.status(401).json({error:"INVALID_TOKEN"}); }
}
function adminOnly(req,res,next){ if(req.user?.role==="ADMIN") return next(); return res.status(403).json({error:"ADMIN_ONLY"}); }

app.get("/api/health",(req,res)=>res.json({ok:true}));

app.post("/api/auth/register",(req,res)=>{
  const {name,email,password}=req.body||{};
  if(!name||!String(name).trim()) return res.status(400).json({error:"INVALID_NAME"});
  if(!email||!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({error:"INVALID_EMAIL"});
  if(!password||String(password).length<6) return res.status(400).json({error:"WEAK_PASSWORD"});
  if(selectOne("SELECT 1 FROM users WHERE email=?", [email.toLowerCase()])) return res.status(409).json({error:"EMAIL_TAKEN"});
  const id=uid("u"); const hash=bcrypt.hashSync(password,10);
  run("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?, 'USER', ?)", [id,String(name).trim(),email.toLowerCase(),hash,new Date().toISOString()]);
  saveDb();
  const user=selectOne("SELECT id,name,email,role,created_at FROM users WHERE id=?", [id]);
  return res.status(201).json({ user, token: issueToken(user) });
});

app.post("/api/auth/login",(req,res)=>{
  const {email,password}=req.body||{};
  const u=selectOne("SELECT * FROM users WHERE email=?", [String(email||'').toLowerCase()]);
  if(!u) return res.status(401).json({error:"BAD_CREDENTIALS"});
  if(!bcrypt.compareSync(String(password||''), u.password_hash)) return res.status(401).json({error:"BAD_CREDENTIALS"});
  const pub={ id:u.id, name:u.name, email:u.email, role:u.role, created_at:u.created_at };
  return res.json({ user: pub, token: issueToken(pub) });
});

app.get("/api/auth/me", auth, (req,res)=>{
  const u=selectOne("SELECT id,name,email,role,created_at FROM users WHERE id=?", [req.user.sub]);
  res.json({ user:u });
});

app.get("/api/config",(req,res)=>{
  const courts=selectAll("SELECT id,name FROM courts ORDER BY id");
  res.json({ clubName: CLUB_NAME, dayStart: DAY_START, dayEnd: DAY_END, slotMinutes: SLOT_MINUTES, courts, rules:{MAX_FUTURE_BOOKINGS, MAX_DAYS_AHEAD, UNIQUE_PER_TIMESLOT} });
});

app.get("/api/slots",(req,res)=>{
  const {date}=req.query; if(!date||!isValidDateStr(String(date))) return res.status(400).json({error:"INVALID_DATE"});
  const bookings=selectAll("SELECT b.*, u.name as user_name, u.email as user_email FROM bookings b JOIN users u ON u.id=b.user_id WHERE date=? ORDER BY time,court_id",[String(date)]);
  const blocks=selectAll("SELECT * FROM blocks WHERE date=? ORDER BY time,court_id",[String(date)]);
  res.json({bookings,blocks});
});

app.get("/api/my/bookings", auth, (req,res)=>{
  const rows=selectAll("SELECT * FROM bookings WHERE user_id=? ORDER BY date,time",[req.user.sub]);
  res.json({bookings:rows});
});

function withinWindow(date){
  const today=new Date(); today.setHours(0,0,0,0);
  const d=new Date(date+"T00:00:00");
  const diffDays=Math.round((d-today)/86400000);
  return diffDays>=0 && diffDays<=MAX_DAYS_AHEAD;
}
function countFutureBookings(userId){
  const todayStr=new Date().toISOString().slice(0,10);
  return selectOne("SELECT COUNT(*) as c FROM bookings WHERE user_id=? AND date >= ?",[userId,todayStr])?.c || 0;
}
function hasBookingSameTimeslot(userId,date,time){
  return !!selectOne("SELECT 1 FROM bookings WHERE user_id=? AND date=? AND time=?",[userId,date,time]);
}

app.post("/api/bookings", auth, (req,res)=>{
  const {date,time,courtId,note}=req.body||{};
  if(!date||!isValidDateStr(date)) return res.status(400).json({error:"INVALID_DATE"});
  if(!time||!isValidTimeStr(time)) return res.status(400).json({error:"INVALID_TIME"});
  if(!courtId||isNaN(parseInt(courtId))) return res.status(400).json({error:"INVALID_COURT"});
  if(!withinWindow(date)) return res.status(403).json({error:"OUT_OF_WINDOW"});
  if(selectOne("SELECT 1 FROM bookings WHERE date=? AND time=? AND court_id=?", [date,time,courtId])) return res.status(409).json({error:"ALREADY_BOOKED"});
  if(UNIQUE_PER_TIMESLOT && hasBookingSameTimeslot(req.user.sub,date,time)) return res.status(409).json({error:"USER_ALREADY_BOOKED_THIS_TIMESLOT"});
  const current=countFutureBookings(req.user.sub); if(current>=MAX_FUTURE_BOOKINGS) return res.status(403).json({error:"BOOKING_LIMIT_REACHED"});
  const id=uid("b"); run("INSERT INTO bookings (id,date,time,court_id,user_id,note,created_at) VALUES (?,?,?,?,?,?,?)",[id,date,time,courtId,req.user.sub,note||null,new Date().toISOString()]);
  saveDb();
  const booking=selectOne("SELECT b.*, u.name as user_name, u.email as user_email FROM bookings b JOIN users u ON u.id=b.user_id WHERE b.id=?", [id]);
  res.status(201).json({ booking });
});

app.delete("/api/bookings/:id", auth, (req,res)=>{
  const {id}=req.params; const b=selectOne("SELECT * FROM bookings WHERE id=?", [id]);
  if(!b) return res.status(404).json({error:"NOT_FOUND"});
  const isOwner=b.user_id===req.user.sub; const isAdmin=req.user.role==="ADMIN";
  if(!isOwner && !isAdmin) return res.status(403).json({error:"FORBIDDEN"});
  run("DELETE FROM bookings WHERE id=?", [id]); saveDb(); res.json({ok:true});
});

// ---- Blocks (ADMIN) ----
app.post("/api/blocks", auth, adminOnly, (req,res)=>{
  const {date,time,courtId,reason}=req.body||{};
  if(!date||!isValidDateStr(date)) return res.status(400).json({error:"INVALID_DATE"});
  if(!time||!isValidTimeStr(time)) return res.status(400).json({error:"INVALID_TIME"});
  if(!courtId||isNaN(parseInt(courtId))) return res.status(400).json({error:"INVALID_COURT"});
  if(selectOne("SELECT 1 FROM blocks WHERE date=? AND time=? AND court_id=?", [date,time,courtId])) return res.status(409).json({error:"ALREADY_BLOCKED"});
  if(selectOne("SELECT 1 FROM bookings WHERE date=? AND time=? AND court_id=?", [date,time,courtId])) return res.status(409).json({error:"BOOKING_EXISTS"});
  const id=uid("bl"); run("INSERT INTO blocks (id,date,time,court_id,reason) VALUES (?,?,?,?,?)",[id,date,time,courtId,reason||null]);
  saveDb(); const block=selectOne("SELECT * FROM blocks WHERE id=?", [id]); res.status(201).json({block});
});

app.delete("/api/blocks/:id", auth, adminOnly, (req,res)=>{
  const {id}=req.params; const bl=selectOne("SELECT * FROM blocks WHERE id=?", [id]);
  if(!bl) return res.status(404).json({error:"NOT_FOUND"});
  run("DELETE FROM blocks WHERE id=?", [id]); saveDb(); res.json({ok:true});
});

// Export CSV
app.get("/api/export/csv", auth, (req,res)=>{
  if(req.user?.role!=='ADMIN') return res.status(403).json({error:'ADMIN_ONLY'});
  const { from, to } = req.query;
  const rows = selectAll(`
    SELECT date, time, court_id, u.name as user_name, u.email as user_email, b.note, b.created_at
    FROM bookings b JOIN users u ON u.id=b.user_id
    WHERE (? IS NULL OR date >= ?) AND (? IS NULL OR date <= ?)
    ORDER BY date, time, court_id
  `, [from||null, from||null, to||null, to||null]);
  const head = ["date","time","court","user_name","user_email","note","created_at"];
  const csv = [head.join(","), ...rows.map(r => [r.date,r.time,r.court_id,r.user_name,r.user_email,(r.note||"").replace(/,/g,";"),r.created_at].join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="export_${from||'all'}_${to||'all'}.csv"`);
  res.send(csv);
});

// ICS
app.get("/api/bookings/:id/ics", auth, (req,res)=>{
  const { id } = req.params;
  const b = selectOne("SELECT b.*, u.name as user_name, u.email as user_email FROM bookings b JOIN users u ON u.id=b.user_id WHERE b.id=?", [id]);
  if(!b) return res.status(404).send("NOT_FOUND");
  const [h,m] = b.time.split(":").map(x=>parseInt(x,10));
  const [Y,Mo,Da] = b.date.split("-").map(x=>parseInt(x,10));
  const start = new Date(Date.UTC(Y, Mo-1, Da, h, m, 0));
  const end = new Date(start.getTime() + parseInt(SLOT_MINUTES,10)*60000);
  function fmt(d){ return d.toISOString().replace(/[-:]/g,"").split(".")[0]+"Z"; }
  const ics = [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//M Squash//Booking//EN","BEGIN:VEVENT",
    `UID:${b.id}@msquash`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Squash - Court ${b.court_id}`,
    `DESCRIPTION:Réservation par ${b.user_name}${b.note? "\\nNote: "+b.note.replace(/\\n/g," ") : ""}`,
    "END:VEVENT","END:VCALENDAR"
  ].join("\r\n");
  res.setHeader("Content-Type","text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="booking_${b.id}.ics"`);
  res.send(ics);
});

process.on("SIGINT", ()=>{ try{saveDb()}catch{} process.exit(0) });
process.on("SIGTERM", ()=>{ try{saveDb()}catch{} process.exit(0) });

app.listen(PORT, ()=> console.log(`✅ API on http://localhost:${PORT}`));
