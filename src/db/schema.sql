-- Ye schema actual D1 database se match karta hai

CREATE TABLE IF NOT EXISTS USERS(
   id  INTEGER PRIMARY KEY AUTOINCREMENT,
   name  TEXT NOT NULL,
   email TEXT UNIQUE NOT NULL,
   password  TEXT NOT NULL,
   created_at TEXT DEFAULT (datetime('now')),
   is_verified INTEGER DEFAULT 0,
   salary INTEGER DEFAULT 0,
   expense_limit INTEGER DEFAULT 0,
   is_saving_mode INTEGER DEFAULT 0,
   currency TEXT DEFAULT 'INR'
);

CREATE TABLE IF NOT EXISTS OTPS(
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   email TEXT NOT NULL,
   otp_hash TEXT NOT NULL,
   expires_at TEXT NOT NULL,
   created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ACCOUNTS(
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   user_id INTEGER,
   name TEXT
);

CREATE TABLE IF NOT EXISTS TRANSACTIONS(
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   user_id INTEGER,
   type TEXT,
   amount INTEGER,
   description TEXT,
   account_id INTEGER,
   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
   is_hidden INTEGER DEFAULT 0
);
