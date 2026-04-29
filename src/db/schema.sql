CREATE TABLE IF NOT EXISTS USERS(
   id  INTEGER PRIMARY KEY AUTOINCREMENT,
   name  TEXT NOT NULL,
   email TEXT UNIQUE NOT NULL,
   password  TEXT NOT NULL,
   is_verified INTEGER DEFAULT 0,
   created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS OTPS(
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   email TEXT NOT NULL,
   otp_hash TEXT NOT NULL,
   expires_at TEXT NOT NULL,
   created_at TEXT DEFAULT (datetime('now'))
);
