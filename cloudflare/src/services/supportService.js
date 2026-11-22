/**
 * Support / contact tickets stored in D1 (admin-visible).
 */

const TICKET_TYPES = new Set(['queja', 'sugerencia', 'soporte', 'export', 'otro']);
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 8;
const ticketAttempts = new Map();

function nowIso() {
  return new Date().toISOString();
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function validateTicketType(raw) {
  const t = String(raw || 'soporte')
    .trim()
    .toLowerCase();
  if (!TICKET_TYPES.has(t)) return { ok: false, error: 'Tipo no válido' };
  return { ok: true, type: t };
}

export function validateTicketFields({ name, email, subject, message }) {
  const n = String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 80) {
    return { ok: false, error: 'Indica un nombre válido' };
  }
  const e = String(email || '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 160) {
    return { ok: false, error: 'Email no válido' };
  }
  const s = String(subject || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (s.length < 3 || s.length > 120) {
    return { ok: false, error: 'Asunto demasiado corto o largo' };
  }
  const m = String(message || '').trim();
  if (m.length < 10 || m.length > 4000) {
    return { ok: false, error: 'Mensaje: entre 10 y 4000 caracteres' };
  }
  return { ok: true, name: n, email: e, subject: s, message: m };
}

export function checkTicketRateLimit(key) {
  const k = String(key || 'anon');
  const now = Date.now();
  let entry = ticketAttempts.get(k);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    entry = { start: now, count: 0 };
    ticketAttempts.set(k, entry);
  }
  entry.count += 1;
  if (entry.count > RATE_MAX) {
    return { ok: false, error: 'Demasiados envíos. Prueba más tarde.' };
  }
  return { ok: true };
}

export async function createTicket(db, { name, email, subject, message, ticketType, userId, ip }) {
  const id = randomHex(16);
  const ts = nowIso();
  await db.run(
    `INSERT INTO support_tickets
      (id, user_id, name, email, subject, message, ticket_type, status, ip, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'open', ?8, ?9, ?10)`,
    id,
    userId || null,
    name,
    email,
    subject,
    message,
    ticketType,
    ip || null,
    ts,
    ts
  );
  return { id, createdAt: ts };
}

export async function listTickets(db, { limit = 100 } = {}) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 100));
  const rows = await db.all(
    `SELECT id, user_id, name, email, subject, message, ticket_type, status, ip, created_at, updated_at
     FROM support_tickets
     ORDER BY created_at DESC
     LIMIT ?1`,
    lim
  );
  return Array.isArray(rows) ? rows : rows?.results || [];
}

/** Tickets created in [startIso, endIso) — UTC day window. */
export async function countTicketsToday(db, { startIso, endIso } = {}) {
  let start = startIso;
  let end = endIso;
  if (!start || !end) {
    const dayStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
    );
    start = start || dayStart.toISOString();
    end = end || new Date(dayStart.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
  const row = await db.first(
    `SELECT COUNT(*) AS n FROM support_tickets
     WHERE created_at >= ?1 AND created_at < ?2`,
    String(start),
    String(end)
  );
  return Number(row?.n) || 0;
}

export async function buildUserExport(db, user) {
  if (!user) return null;
  const sessions = await db.all(
    `SELECT id, active, expires_at, created_at, last_seen_at, ip
     FROM auth_sessions WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 50`,
    String(user.id)
  );
  const tickets = await db.all(
    `SELECT id, subject, ticket_type, status, created_at
     FROM support_tickets WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 50`,
    String(user.id)
  );
  const prem = await db.first(
    `SELECT premium_until, premium_started_at, plan, stripe_subscription_id
     FROM premium_sessions WHERE user_id = ?1 ORDER BY premium_until DESC LIMIT 1`,
    String(user.id)
  );
  return {
    exportedAt: nowIso(),
    user: {
      id: user.id,
      username: user.username || null,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      provider: user.provider,
      createdAt: user.created_at || null,
    },
    premium: prem || null,
    sessions: Array.isArray(sessions) ? sessions : sessions?.results || [],
    supportTickets: Array.isArray(tickets) ? tickets : tickets?.results || [],
  };
}
