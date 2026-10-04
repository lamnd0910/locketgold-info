ALTER TABLE orders ADD COLUMN expires_at TEXT;
ALTER TABLE orders ADD COLUMN expired_at TEXT;
UPDATE orders SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+10 minutes') WHERE ctv_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_pending_expiry ON orders(status, expires_at);
