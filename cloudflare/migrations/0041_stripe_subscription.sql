-- Stripe subscription id for renewal / cancel sync (webhook).
ALTER TABLE premium_sessions ADD COLUMN stripe_subscription_id TEXT;
CREATE INDEX IF NOT EXISTS idx_premium_sessions_stripe_sub
  ON premium_sessions(stripe_subscription_id);
