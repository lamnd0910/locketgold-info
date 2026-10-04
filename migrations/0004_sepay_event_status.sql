ALTER TABLE payment_events ADD COLUMN order_code TEXT;
ALTER TABLE payment_events ADD COLUMN outcome TEXT NOT NULL DEFAULT 'legacy';
CREATE INDEX IF NOT EXISTS idx_payment_events_provider_created ON payment_events(provider, id DESC);
