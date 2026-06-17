// Seed demo data: one owner (demo@vouch.app / password "password123") + endorsements.
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const db = new Database(path.join(process.cwd(), "vouch.db"));
db.pragma("journal_mode = WAL");
// Single source of truth — same DDL the app uses (constraints + indexes).
db.exec(fs.readFileSync(path.join(process.cwd(), "lib", "schema.sql"), "utf8"));

const email = "demo@vouch.app";
let owner = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
if (!owner) {
  const info = db
    .prepare(
      `INSERT INTO users (name,email,password_hash,slug,headline,location,identity_verified,open_to_work,email_confirmed)
       VALUES (?,?,?,?,?,?,1,1,1)`,
    )
    .run(
      "Maya Okonkwo",
      email,
      hashPassword("password123"),
      "maya-okonkwo",
      "Senior Product Designer · ex-Figma",
      "Lisbon, Portugal",
    );
  owner = { id: Number(info.lastInsertRowid), slug: "maya-okonkwo" };
  console.log("Created demo owner:", email, "/ password123  → /u/maya-okonkwo");
} else {
  console.log("Demo owner already exists:", email);
}

const seed = [
  [
    "Daniel Reyes",
    "dreyes@stripe.com",
    "VP Design",
    "Stripe",
    "manager",
    5,
    "Maya is the rare designer who makes the whole team better. She led our checkout redesign end to end — <em>cut drop-off by 23%</em> — and did it while mentoring two juniors. I'd hire her again in a heartbeat.",
    ["Leadership", "Strategy", "Mentorship"],
    "approved",
    1,
    1,
    1,
  ],
  [
    "Priya Nair",
    "priya@notion.so",
    "Staff Engineer",
    "Notion",
    "peer",
    5,
    "We shipped three big launches together. Maya's specs are so clear engineers barely had questions. <em>Calm under pressure</em> and genuinely fun to build with.",
    ["Communication", "Execution"],
    "approved",
    1,
    1,
    0,
  ],
  [
    "Tom Albrecht",
    "tom@acme.io",
    "Founder",
    "Acme",
    "client",
    4,
    "Hired Maya for a brand and product refresh. Delivered ahead of schedule and pushed back on the right things. Would recommend to any founder.",
    ["Reliability", "Ownership"],
    "approved",
    1,
    1,
    0,
  ],
  [
    "Lena Fischer",
    "lfischer@figma.com",
    "Design Lead",
    "Figma",
    "report",
    5,
    "Maya was my manager for two years. She gave me room to grow and the feedback that actually changed my career. <em>The best manager I've had.</em>",
    ["Mentorship", "Empathy"],
    "approved",
    1,
    1,
    1,
  ],
  [
    "Sam Carter",
    "sam@gmail.com",
    "Freelancer",
    null,
    "partner",
    4,
    "Collaborated on a side project. Solid eye, easy to work with.",
    [],
    "pending",
    0,
    0,
    0,
  ],
  [
    "Jordan Blake",
    "jblake@linear.app",
    "PM",
    "Linear",
    "peer",
    5,
    "Maya turned a vague brief into a product people love. Detail-obsessed in the best way.",
    ["Problem solving", "Creativity"],
    "pending",
    1,
    1,
    0,
  ],
  [
    "Anon User",
    "noreply@tempmail.io",
    "—",
    null,
    "client",
    3,
    "good designer would work again",
    [],
    "pending",
    0,
    0,
    0,
  ],
];

const insert = db.prepare(
  `INSERT INTO endorsements
   (user_id,reviewer_name,reviewer_email,reviewer_role,reviewer_company,relationship,rating,body,strengths,status,email_confirmed,employer_overlap_verified,linkedin_matched,resolved_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);

const existing = db
  .prepare("SELECT COUNT(*) c FROM endorsements WHERE user_id = ?")
  .get(owner.id).c;
if (existing === 0) {
  for (const r of seed) {
    insert.run(
      owner.id,
      r[0],
      r[1],
      r[2],
      r[3],
      r[4],
      r[5],
      r[6],
      r[7].length ? JSON.stringify(r[7]) : null,
      r[8],
      r[9],
      r[10],
      r[11],
      r[8] === "approved" ? new Date().toISOString() : null,
    );
  }
  console.log(`Inserted ${seed.length} endorsements.`);
} else {
  console.log(`Owner already has ${existing} endorsements — skipping.`);
}

db.close();
