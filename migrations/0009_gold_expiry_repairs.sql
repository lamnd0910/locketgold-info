CREATE TABLE IF NOT EXISTS gold_expiry_repairs (
  order_code TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
