-- AP CRM — initial D1 schema.
-- Mirrors the in-app object shape (relationships are by name, matching the frontend).

CREATE TABLE IF NOT EXISTS accounts (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  industry  TEXT,
  website   TEXT,
  notes     TEXT,
  owner     TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  id        TEXT PRIMARY KEY,
  account   TEXT,
  name      TEXT NOT NULL,
  role      TEXT,
  email     TEXT,
  phone     TEXT,
  owner     TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS leads (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  company   TEXT,
  email     TEXT,
  phone     TEXT,
  status    TEXT,
  notes     TEXT,
  owner     TEXT,
  source    TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS opportunities (
  id        TEXT PRIMARY KEY,
  account   TEXT,
  name      TEXT NOT NULL,
  stage     TEXT,
  value     REAL DEFAULT 0,
  closeDate TEXT,
  notes     TEXT,
  owner     TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  id          TEXT PRIMARY KEY,
  type        TEXT,
  subject     TEXT,
  relatedType TEXT,
  relatedName TEXT,
  dueDate     TEXT,
  status      TEXT,
  notes       TEXT,
  owner       TEXT,
  createdAt   TEXT
);

CREATE INDEX IF NOT EXISTS idx_contacts_account      ON contacts(account);
CREATE INDEX IF NOT EXISTS idx_opportunities_account ON opportunities(account);
CREATE INDEX IF NOT EXISTS idx_activities_related    ON activities(relatedType, relatedName);
CREATE INDEX IF NOT EXISTS idx_leads_email           ON leads(email);
