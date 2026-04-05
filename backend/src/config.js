import dotenv from "dotenv";
dotenv.config();

function required(name, fallback) {
  const v = process.env[name];
  if (!v) {
    if (fallback !== undefined) return fallback;
    console.error(`[config] Missing required env variable: ${name}`);
    process.exit(1);
  }
  return v;
}

const JWT_SECRET = process.env.JWT_SECRET || "devsecret";
if (JWT_SECRET === "devsecret") {
  console.warn("[config] WARNING: JWT_SECRET is using insecure default. Set a strong secret in .env for production.");
}

export const config = {
  PORT:                parseInt(process.env.PORT || "4000", 10),
  JWT_SECRET,
  JWT_EXPIRES_IN:      process.env.JWT_EXPIRES_IN     || "7d",
  CORS_ORIGIN:         process.env.CORS_ORIGIN        || "*",

  CLUB_NAME:           process.env.CLUB_NAME          || "M Squash",
  DAY_START:           process.env.DAY_START          || "08:00",
  DAY_END:             process.env.DAY_END            || "22:00",
  SLOT_MINUTES:        parseInt(process.env.SLOT_MINUTES || "45", 10),
  COURTS:              parseInt(process.env.COURTS    || "4", 10),

  MAX_FUTURE_BOOKINGS: parseInt(process.env.MAX_FUTURE_BOOKINGS || "2", 10),
  MAX_DAYS_AHEAD:      parseInt(process.env.MAX_DAYS_AHEAD      || "14", 10),
  UNIQUE_PER_TIMESLOT: (process.env.UNIQUE_PER_TIMESLOT || "true").toLowerCase() === "true",

  ADMIN_SEED_EMAIL:    process.env.ADMIN_SEED_EMAIL    || "admin@club.local",
  ADMIN_SEED_PASSWORD: process.env.ADMIN_SEED_PASSWORD || "admin1234",
  ADMIN_SEED_NAME:     process.env.ADMIN_SEED_NAME     || "Club Admin",
};

// Carte d'abonnement : 1 unité = 1 séance par personne
// 1 créneau réservé = 2 unités au total (1 par joueur, ou 2 sur une seule carte)
export const CARD_TYPES = {
  CARD_8:       { label: "Carte 8 séances",  units: 8,  price: 85,  validMonths: 12 },
  CARD_16:      { label: "Carte 16 séances", units: 16, price: 155, validMonths: 12 },
  CARD_24:      { label: "Carte 24 séances", units: 24, price: 215, validMonths: 12 },
  FORFAIT_CLUB: { label: "Forfait Club",     units: 65, price: 600, validMonths: 12 },
};
