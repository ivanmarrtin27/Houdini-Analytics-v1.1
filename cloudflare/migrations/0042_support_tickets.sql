-- Support / contact tickets (quejas, sugerencias, soporte, export requests).
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  ticket_type TEXT NOT NULL DEFAULT 'soporte',
  status TEXT NOT NULL DEFAULT 'open',
  ip TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_created
  ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON support_tickets(user_id);
