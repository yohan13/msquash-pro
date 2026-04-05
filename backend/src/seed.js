/**
 * Seeder de données de démonstration
 * Usage : node src/seed.js
 *
 * Crée des utilisateurs, des réservations sur 2 mois passés + 2 semaines futures
 * et quelques blocages (tournois, entretien).
 */
import bcrypt from "bcryptjs";
import { selectOne, selectAll, run, saveDb, uid, db } from "./db.js";
import { config, CARD_TYPES } from "./config.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function today() { return new Date().toISOString().slice(0, 10); }

function genSlots(start, end, step) {
  const slots = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMins = eh * 60 + em;
  while (cur < endMins) {
    const h = Math.floor(cur / 60), m = cur % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    cur += step;
  }
  return slots;
}

// ─── Users ────────────────────────────────────────────────────────────────────

const USERS = [
  { name: "Marie Dupont",    email: "marie.dupont@club.local",    password: "Test1234!", role: "ADMIN" },
  { name: "Thomas Martin",   email: "thomas.martin@club.local",   password: "Test1234!", role: "USER" },
  { name: "Julie Bernard",   email: "julie.bernard@club.local",   password: "Test1234!", role: "USER" },
  { name: "Pierre Leclerc",  email: "pierre.leclerc@club.local",  password: "Test1234!", role: "USER" },
  { name: "Sarah Lefebvre",  email: "sarah.lefebvre@club.local",  password: "Test1234!", role: "USER" },
  { name: "Lucas Moreau",    email: "lucas.moreau@club.local",    password: "Test1234!", role: "USER" },
  { name: "Emma Petit",      email: "emma.petit@club.local",      password: "Test1234!", role: "USER" },
  { name: "Antoine Girard",  email: "antoine.girard@club.local",  password: "Test1234!", role: "USER" },
];

console.log("🌱  Seeding demo data...");

// Skip user+booking creation if already seeded
const existingUsers = selectOne("SELECT COUNT(*) as c FROM users WHERE role = 'USER'")?.c || 0;
const skipUsersAndBookings = existingUsers >= 5;
if (skipUsersAndBookings) console.log("   Utilisateurs et réservations déjà présents — skip partiel.");

// ─── Users + Bookings + Blocks (skip si déjà présents) ───────────────────────

// Toujours charger les userIds (nécessaire pour les abonnements et player2)
const userIds = {};
for (const u of USERS) {
  const existing = selectOne("SELECT id FROM users WHERE email = ?", [u.email]);
  if (existing) { userIds[u.email] = existing.id; continue; }
  const id   = uid("u");
  const hash = bcrypt.hashSync(u.password, 10);
  run(
    "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, u.name, u.email, hash, u.role, new Date(Date.now() - Math.random() * 60 * 86400000).toISOString()]
  );
  userIds[u.email] = id;
}
if (!skipUsersAndBookings) {
  saveDb();
  console.log(`   ${USERS.length} utilisateurs créés.`);
}

const memberEmails = USERS.filter((u) => u.role === "USER").map((u) => u.email);
const courts = selectAll("SELECT id FROM courts ORDER BY id");
const slots  = genSlots(config.DAY_START, config.DAY_END, config.SLOT_MINUTES);
const todayStr = today();

let bookingCount = 0;
if (!skipUsersAndBookings) {

// Past bookings: 60 days
for (let dayOffset = -60; dayOffset < 0; dayOffset++) {
  const dateStr = addDays(todayStr, dayOffset);
  const weekday = new Date(dateStr + "T12:00:00").getDay(); // 0=Sun,6=Sat

  // More bookings on weekends
  const slotsToFill = weekday === 0 || weekday === 6 ? 12 : 6;

  for (let k = 0; k < slotsToFill; k++) {
    const slot    = slots[Math.floor(Math.random() * slots.length)];
    const court   = courts[Math.floor(Math.random() * courts.length)];
    const userEmail = memberEmails[Math.floor(Math.random() * memberEmails.length)];
    const userId  = userIds[userEmail];

    const exists = selectOne(
      "SELECT 1 FROM bookings WHERE date = ? AND time = ? AND court_id = ?",
      [dateStr, slot, court.id]
    );
    if (exists) continue;

    const notePool = [null, null, null, "Match classé", "Entraînement solo", "Duo avec un ami", "Prépa tournoi", "Match amical"];
    const note = notePool[Math.floor(Math.random() * notePool.length)];

    const id = uid("b");
    const createdAt = new Date(dateStr + "T" + slot + ":00").toISOString();
    run(
      "INSERT INTO bookings (id, date, time, court_id, user_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, dateStr, slot, court.id, userId, note, createdAt]
    );
    bookingCount++;
  }
}

// Future bookings: next 10 days (limited by MAX_FUTURE_BOOKINGS per user in reality,
// but seed bypasses business rules for demo purposes)
const futureBookingsPerUser = {};
for (let dayOffset = 0; dayOffset <= 10; dayOffset++) {
  const dateStr = addDays(todayStr, dayOffset);
  const weekday = new Date(dateStr + "T12:00:00").getDay();
  const slotsToFill = weekday === 0 || weekday === 6 ? 6 : 3;

  for (let k = 0; k < slotsToFill; k++) {
    const slot    = slots[Math.floor(Math.random() * slots.length)];
    const court   = courts[Math.floor(Math.random() * courts.length)];
    const userEmail = memberEmails[Math.floor(Math.random() * memberEmails.length)];
    const userId  = userIds[userEmail];

    const exists = selectOne(
      "SELECT 1 FROM bookings WHERE date = ? AND time = ? AND court_id = ?",
      [dateStr, slot, court.id]
    );
    if (exists) continue;

    const id = uid("b");
    run(
      "INSERT INTO bookings (id, date, time, court_id, user_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, dateStr, slot, court.id, userId, null, new Date().toISOString()]
    );
    bookingCount++;
  }
}

saveDb();
console.log(`   ${bookingCount} réservations créées.`);

// ─── Blocks ───────────────────────────────────────────────────────────────────

const blocks = [
  // Tournoi interne ce week-end
  { date: addDays(todayStr, 5), timeStart: "09:00", timeEnd: "13:00", courts: [1, 2], reason: "Tournoi interne" },
  // Entretien court 3 demain matin
  { date: addDays(todayStr, 1), timeStart: "08:00", timeEnd: "10:00", courts: [3], reason: "Entretien court" },
  // Cours collectif hebdomadaire
  { date: addDays(todayStr, 3), timeStart: "18:00", timeEnd: "20:00", courts: [4], reason: "Cours collectif débutants" },
];

let blockCount = 0;
const allSlots = genSlots(config.DAY_START, config.DAY_END, config.SLOT_MINUTES);

for (const blockDef of blocks) {
  for (const courtId of blockDef.courts) {
    for (const slot of allSlots) {
      const [sh, sm] = blockDef.timeStart.split(":").map(Number);
      const [eh, em] = blockDef.timeEnd.split(":").map(Number);
      const [tsh, tsm] = slot.split(":").map(Number);
      const startMins = sh * 60 + sm;
      const endMins   = eh * 60 + em;
      const slotMins  = tsh * 60 + tsm;
      if (slotMins < startMins || slotMins >= endMins) continue;

      const existsBlock   = selectOne("SELECT 1 FROM blocks WHERE date = ? AND time = ? AND court_id = ?", [blockDef.date, slot, courtId]);
      const existsBooking = selectOne("SELECT 1 FROM bookings WHERE date = ? AND time = ? AND court_id = ?", [blockDef.date, slot, courtId]);
      if (existsBlock || existsBooking) continue;

      const id = uid("bl");
      run("INSERT INTO blocks (id, date, time, court_id, reason) VALUES (?, ?, ?, ?, ?)",
        [id, blockDef.date, slot, courtId, blockDef.reason]);
      blockCount++;
    }
  }
}

saveDb();
console.log(`   ${blockCount} créneaux bloqués créés.`);

} // end !skipUsersAndBookings

// ─── Abonnements démo ─────────────────────────────────────────────────────────

const existingSubs = selectOne("SELECT COUNT(*) as c FROM subscriptions")?.c || 0;
let subCount = 0;

if (existingSubs === 0) {
  // Distribution réaliste des cartes parmi les membres
  const subDefs = [
    { email: "thomas.martin@club.local",   cardType: "CARD_24",      usedFraction: 0.6 },
    { email: "julie.bernard@club.local",   cardType: "CARD_16",      usedFraction: 0.3 },
    { email: "pierre.leclerc@club.local",  cardType: "CARD_8",       usedFraction: 0.9 },
    { email: "sarah.lefebvre@club.local",  cardType: "FORFAIT_CLUB", usedFraction: 0.4 },
    { email: "lucas.moreau@club.local",    cardType: "CARD_16",      usedFraction: 0.1 },
    { email: "emma.petit@club.local",      cardType: "CARD_24",      usedFraction: 0.5 },
    // antoine et marie n'ont pas de carte (paiement à la séance)
  ];

  for (const def of subDefs) {
    const user = selectOne("SELECT id FROM users WHERE email = ?", [def.email]);
    if (!user) continue;
    const card = CARD_TYPES[def.cardType];
    const usedUnits = Math.floor(card.units * def.usedFraction);
    const purchasedAt = new Date(Date.now() - Math.random() * 90 * 86400000).toISOString();
    const expiresAt   = new Date(Date.now() + card.validMonths * 30 * 24 * 3600 * 1000)
                          .toISOString().slice(0, 10);
    const id = uid("sub");
    run(
      `INSERT INTO subscriptions (id, user_id, card_type, total_units, used_units, purchased_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, def.cardType, card.units, usedUnits, purchasedAt, expiresAt]
    );
    subCount++;
  }
  saveDb();
}
console.log(`   ${subCount > 0 ? subCount : "déjà présents"} abonnements créés.`);

// ─── Player2 sur les réservations récentes ────────────────────────────────────

const recentBookings = selectAll(
  `SELECT id, user_id FROM bookings
   WHERE player2_id IS NULL AND player2_name IS NULL
   ORDER BY date DESC LIMIT 60`
);

let p2Count = 0;
const memberIds = USERS.filter(u => u.role === "USER")
  .map(u => selectOne("SELECT id FROM users WHERE email = ?", [u.email])?.id)
  .filter(Boolean);

for (const b of recentBookings) {
  if (Math.random() > 0.6) continue; // 40% des réservations ont un player2
  const otherMembers = memberIds.filter(id => id !== b.user_id);
  if (!otherMembers.length) continue;
  const p2Id = otherMembers[Math.floor(Math.random() * otherMembers.length)];
  run("UPDATE bookings SET player2_id = ? WHERE id = ?", [p2Id, b.id]);
  p2Count++;
}
saveDb();
console.log(`   ${p2Count} réservations mises à jour avec un adversaire.`);

// ─── Summary ──────────────────────────────────────────────────────────────────

const stats = {
  users:    selectOne("SELECT COUNT(*) as c FROM users")?.c,
  bookings: selectOne("SELECT COUNT(*) as c FROM bookings")?.c,
  blocks:   selectOne("SELECT COUNT(*) as c FROM blocks")?.c,
  subs:     selectOne("SELECT COUNT(*) as c FROM subscriptions")?.c,
};

console.log(`\n✅  Données de démo chargées :`);
console.log(`   👤 ${stats.users} utilisateurs`);
console.log(`   📅 ${stats.bookings} réservations`);
console.log(`   🚫 ${stats.blocks} créneaux bloqués`);
console.log(`   🎫 ${stats.subs} abonnements`);
console.log(`\n   Logins démo :`);
console.log(`   admin@club.local    / ${config.ADMIN_SEED_PASSWORD}  (Admin)`);
USERS.forEach((u) => console.log(`   ${u.email.padEnd(32)} / Test1234!`));
