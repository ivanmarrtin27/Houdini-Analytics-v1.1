/**
 * Premium access — guest cookie `hb_prem` and/or linked `user_id`.
 *
 *  - Browser gets HttpOnly cookie (`hb_prem` = `<id>.<secret>`).
 *  - When a user logs in, the active premium session is attached via `user_id`.
 *  - Stripe Checkout Subscriptions: `client_reference_id` = session id;
 *    webhook syncs `premium_until` from subscription period (renewals too).
 *  - Admin list joins the latest active premium row per user.
 */

const COOKIE_NAME = 'hb_prem';
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const DEFAULT_PREMIUM_DAYS = 30;
const SIGNATURE_TOLERANCE_SECONDS = 300;

/** UI / Checkout plan keys → approximate period days (fallback if Stripe period missing). */
export const PLAN_PERIOD_DAYS = Object.freeze({
  weekly: 7,
  monthly: 31,
  quarterly: 92,
  annual: 366,
});

export const STRIPE_PLAN_KEYS = Object.freeze(['weekly', 'monthly', 'quarterly', 'annual']);

function nowIso() {
  return new Date().toISOString();
}

function plusDays(days, from = new Date()) {
  const base = new Date(from.getTime());
  base.setUTCDate(base.getUTCDate() + Math.max(0, Math.round(Number(days) || 0)));
  return base.toISOString();
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison for equal-length hex strings. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isPremiumActive(row, at = new Date()) {
  if (!row || Number(row.active) !== 1) return false;
  const until = row.premium_until ? Date.parse(row.premium_until) : NaN;
  if (!Number.isFinite(until)) return false;
  return until > at.getTime();
}

/* ------------------------------------------------------------------ *
 * Guest sessions
 * ------------------------------------------------------------------ */

export async function createPremiumSession(db, { days = 0, userId = null } = {}) {
  const id = randomHex(16);
  const secret = randomHex(32);
  const tokenHash = await sha256Hex(secret);
  const ts = nowIso();
  const until = days > 0 ? plusDays(days) : null;
  const started = days > 0 ? ts : null;
  await db.run(
    `INSERT INTO premium_sessions
      (id, token_hash, active, premium_until, created_at, user_id, premium_started_at)
     VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6)`,
    id,
    tokenHash,
    until,
    ts,
    userId ? String(userId) : null,
    started
  );
  return { id, cookieValue: `${id}.${secret}` };
}

/** Attach an existing premium cookie session to a logged-in user. */
export async function attachPremiumSessionToUser(db, cookieValue, userId) {
  if (!cookieValue || !userId) return null;
  const { session } = await resolvePremiumSession(db, cookieValue);
  if (!session?.id) return null;
  await db.run(
    `UPDATE premium_sessions SET user_id = ?2 WHERE id = ?1`,
    session.id,
    String(userId)
  );
  return session.id;
}

/** Latest active premium row for a user (by premium_until / started). */
export async function findPremiumForUser(db, userId) {
  if (!userId) return null;
  const row = await db.first(
    `SELECT * FROM premium_sessions
     WHERE user_id = ?1 AND active = 1
     ORDER BY COALESCE(premium_until, created_at) DESC
     LIMIT 1`,
    String(userId)
  );
  return row || null;
}

export function premiumMetaFromRow(row, at = new Date()) {
  const active = isPremiumActive(row, at);
  const until = row?.premium_until || null;
  const started = row?.premium_started_at || (active ? row?.created_at : null) || null;
  let daysLeft = null;
  if (active && until) {
    const ms = Date.parse(until) - at.getTime();
    daysLeft = Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 86400000)) : null;
  }
  return {
    plan: active ? 'premium' : 'free',
    premium: active,
    premiumStartedAt: started,
    premiumUntil: active ? until : until,
    premiumDaysLeft: daysLeft,
  };
}

/** Extract `hb_prem=<id>.<secret>` from a cookie header (last one wins). */
export function sessionCookieFromHeader(header) {
  if (!header) return null;
  const pairs = header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  let value = null;
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    if (pair.slice(0, eq) === COOKIE_NAME) value = pair.slice(eq + 1);
  }
  return value ? decodeURIComponent(value) : null;
}

export function sessionCookieHeader(cookieValue, { maxAge = SESSION_COOKIE_MAX_AGE } = {}) {
  return {
    name: COOKIE_NAME,
    value: cookieValue,
    toSetCookieString: () =>
      `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`,
  };
}

/**
 * Resolve a cookie value `${id}.${secret}` into `{ session, premium }`.
 * Token mismatch deactivates the session (brute-force guard).
 */
export async function resolvePremiumSession(db, cookieValue) {
  if (!cookieValue) return { session: null, premium: false };
  const dot = cookieValue.indexOf('.');
  if (dot <= 0) return { session: null, premium: false };
  const id = cookieValue.slice(0, dot);
  const secret = cookieValue.slice(dot + 1);
  if (!/^[0-9a-f]{32}$/.test(id) || !/^[0-9a-f]{64}$/.test(secret)) {
    return { session: null, premium: false };
  }
  const row = await db.first(
    `SELECT * FROM premium_sessions WHERE id = ?1 AND active = 1`,
    id
  );
  if (!row) return { session: null, premium: false };
  const hash = await sha256Hex(secret);
  if (!safeEqual(hash, String(row.token_hash))) {
    await db.run(`UPDATE premium_sessions SET active = 0 WHERE id = ?1`, id);
    return { session: null, premium: false };
  }
  const premium = isPremiumActive(row);
  await db.run(`UPDATE premium_sessions SET last_seen_at = ?2 WHERE id = ?1`, id, nowIso());
  return { session: row, premium };
}

/** Extend (or activate) premium access for a session id. */
export async function grantPremium(db, id, { days = DEFAULT_PREMIUM_DAYS, at = new Date() } = {}) {
  const row = await db.first(`SELECT * FROM premium_sessions WHERE id = ?1`, id);
  if (!row) return null;
  const current = row.premium_until ? Date.parse(row.premium_until) : NaN;
  const from = Number.isFinite(current) && current > at.getTime() ? new Date(current) : at;
  const premiumUntil = plusDays(days, from);
  await db.run(
    `UPDATE premium_sessions
     SET premium_until = ?2,
         premium_started_at = COALESCE(premium_started_at, ?3)
     WHERE id = ?1`,
    id,
    premiumUntil,
    nowIso()
  );
  return premiumUntil;
}

/** Set absolute premium_until (subscription period sync — does not stack). */
export async function setPremiumUntil(db, id, untilIso) {
  const until = untilIso ? String(untilIso) : null;
  if (!until) return null;
  const row = await db.first(`SELECT * FROM premium_sessions WHERE id = ?1`, id);
  if (!row) return null;
  await db.run(
    `UPDATE premium_sessions
     SET premium_until = ?2,
         premium_started_at = COALESCE(premium_started_at, ?3)
     WHERE id = ?1`,
    id,
    until,
    nowIso()
  );
  return until;
}

export function normalizeStripePlan(raw, fallback = 'monthly') {
  const plan = String(raw || '')
    .trim()
    .toLowerCase();
  return STRIPE_PLAN_KEYS.includes(plan) ? plan : fallback;
}

export function planPeriodDays(plan, env = null) {
  const key = normalizeStripePlan(plan);
  if (key === 'monthly' && env?.PREMIUM_DAYS != null) {
    const override = Number(env.PREMIUM_DAYS);
    if (Number.isFinite(override) && override > 0) {
      return Math.max(1, Math.min(366, Math.round(override)));
    }
  }
  return PLAN_PERIOD_DAYS[key] || DEFAULT_PREMIUM_DAYS;
}

/** Grant / extend premium for a user account (creates a linked session if needed). */
export async function grantPremiumForUser(db, userId, { days = DEFAULT_PREMIUM_DAYS } = {}) {
  const uid = String(userId);
  let row = await findPremiumForUser(db, uid);
  if (!row) {
    const created = await createPremiumSession(db, { days: 0, userId: uid });
    row = await db.first(`SELECT * FROM premium_sessions WHERE id = ?1`, created.id);
  }
  const until = await grantPremium(db, row.id, { days });
  // Clear any prior sanction when re-granting.
  await db.run(`UPDATE users SET premium_sanction_at = NULL WHERE id = ?1`, uid).catch(() => {});
  return { id: row.id, premiumUntil: until };
}

/** Revoke premium for all sessions linked to a user (same idea as Stripe refund). */
export async function revokePremiumForUser(db, userId, { sanction = false } = {}) {
  const uid = String(userId);
  await db.run(`UPDATE premium_sessions SET premium_until = NULL WHERE user_id = ?1`, uid);
  if (sanction) {
    await db.run(`UPDATE users SET premium_sanction_at = ?2 WHERE id = ?1`, uid, nowIso());
  }
  return { ok: true, userId: uid, sanction: Boolean(sanction) };
}

/* ------------------------------------------------------------------ *
 * Stripe
 * ------------------------------------------------------------------ */

export function stripeConfigured(env) {
  return Boolean(
    env &&
      String(env.STRIPE_SECRET_KEY || '').trim() &&
      (String(env.STRIPE_PRICE_ID_MONTHLY || '').trim() ||
        String(env.STRIPE_PRICE_ID_QUARTERLY || '').trim() ||
        String(env.STRIPE_PRICE_ID_ANNUAL || '').trim() ||
        String(env.STRIPE_PRICE_ID || '').trim() ||
        String(env.STRIPE_PRICE_ID_WEEKLY || '').trim())
  );
}

/**
 * Resolve Stripe Price ID for monthly|quarterly|annual (weekly legacy).
 * Prefer dedicated env vars; fall back to STRIPE_PRICE_ID then monthly.
 */
export function resolveStripePriceId(env, plan = 'monthly') {
  const key = normalizeStripePlan(plan);
  const monthly = String(env?.STRIPE_PRICE_ID_MONTHLY || '').trim();
  const quarterly = String(env?.STRIPE_PRICE_ID_QUARTERLY || '').trim();
  const annual = String(env?.STRIPE_PRICE_ID_ANNUAL || '').trim();
  const weekly = String(env?.STRIPE_PRICE_ID_WEEKLY || '').trim();
  const fallback = String(env?.STRIPE_PRICE_ID || '').trim();
  if (key === 'quarterly') return quarterly || fallback || monthly;
  if (key === 'annual') return annual || fallback || monthly;
  if (key === 'weekly') return weekly || fallback || monthly;
  return monthly || fallback || weekly;
}

/**
 * Form-encoded body for Checkout Sessions API (subscription mode).
 * Flat monthly list price 7,99 € — no first-month intro.
 * Optional `couponId` (Houdini promo % discount) applies as discounts[0].
 */
export function checkoutFormBody({
  clientReferenceId,
  origin,
  priceId,
  couponId = null,
  percentOff = null,
  plan = 'monthly',
  mode = 'subscription',
}) {
  const successBase = `${origin}/?premium=ok`;
  const cancelBase = `${origin}/?premium=cancel`;
  const params = new URLSearchParams();
  const checkoutMode = mode === 'payment' ? 'payment' : 'subscription';
  const planKey = normalizeStripePlan(plan);
  params.set('mode', checkoutMode);
  // Managed Payments is on by default for some Stripe accounts and requires a
  // product tax_code; Premium prices don't have one yet → disable for checkout.
  params.set('managed_payments[enabled]', 'false');
  params.set('client_reference_id', clientReferenceId);
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', successBase);
  params.set('cancel_url', cancelBase);
  params.set('metadata[plan]', planKey);
  params.set('metadata[houdini_session]', String(clientReferenceId));
  if (checkoutMode === 'subscription') {
    params.set('subscription_data[metadata][plan]', planKey);
    params.set('subscription_data[metadata][houdini_session]', String(clientReferenceId));
  }
  if (couponId) {
    params.set('discounts[0][coupon]', String(couponId));
  } else {
    params.set('allow_promotion_codes', 'true');
  }
  if (percentOff != null && Number(percentOff) > 0) {
    params.set('metadata[pending_promo_percent]', String(Math.round(Number(percentOff))));
  }
  return params.toString();
}

/** Prefer env-mapped coupons for known Houdini promo percents. */
function envCouponIdForPercent(env, percentOff) {
  const pct = Math.round(Number(percentOff) || 0);
  if (pct === 20) return String(env?.STRIPE_COUPON_DISCOUNT_20 || '').trim() || null;
  if (pct === 40) return String(env?.STRIPE_COUPON_DISCOUNT_40 || '').trim() || null;
  return null;
}

/** Stable Stripe coupon id for a given percent (idempotent create). */
export function houdiniPercentCouponId(percentOff) {
  const pct = Math.max(1, Math.min(100, Math.round(Number(percentOff) || 0)));
  return `houdini_pct_${pct}_once`;
}

async function fetchStripeCoupon(env, couponId, { fetchImpl = fetch } = {}) {
  const id = String(couponId || '').trim();
  if (!id) return null;
  const res = await fetchImpl(`https://api.stripe.com/v1/coupons/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.id ? data : null;
}

/**
 * Resolve a Stripe Coupon for Houdini percent promos (subscription-safe).
 * Order: env map → existing stable id → create percent_off duration=once.
 * Never overrides line_items amounts (invalid for recurring Prices).
 */
async function resolveStripePercentCoupon(env, percentOff, { fetchImpl = fetch } = {}) {
  const pct = Math.max(1, Math.min(100, Math.round(Number(percentOff) || 0)));
  if (!pct) return { error: 'invalid_percent' };

  const mapped = envCouponIdForPercent(env, pct);
  if (mapped) return { id: mapped, percentOff: pct, source: 'env' };

  const stableId = houdiniPercentCouponId(pct);
  const existing = await fetchStripeCoupon(env, stableId, { fetchImpl });
  if (existing?.id) return { id: existing.id, percentOff: pct, source: 'existing' };

  const body = new URLSearchParams();
  body.set('id', stableId);
  body.set('percent_off', String(pct));
  body.set('duration', 'once');
  body.set('name', `Houdini ${pct}%`);
  const res = await fetchImpl('https://api.stripe.com/v1/coupons', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (res.ok) {
    const data = await res.json();
    return { id: data.id || stableId, percentOff: pct, source: 'created' };
  }
  const detail = await res.text().catch(() => '');
  // Race / already exists → fetch stable id
  if (res.status === 400 && /already exists|resource_already_exists/i.test(detail)) {
    const again = await fetchStripeCoupon(env, stableId, { fetchImpl });
    if (again?.id) return { id: again.id, percentOff: pct, source: 'existing' };
  }
  return { error: `stripe_coupon_${res.status}`, detail: detail.slice(0, 300) };
}

function stripeAuthHeaders(env) {
  return {
    authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    'content-type': 'application/x-www-form-urlencoded',
  };
}

/** Fetch subscription.current_period_end as ISO, or null. */
export async function fetchSubscriptionPeriodEnd(env, subscriptionId, { fetchImpl = fetch } = {}) {
  const subId = String(subscriptionId || '').trim();
  if (!subId || !env?.STRIPE_SECRET_KEY) return null;
  const res = await fetchImpl(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const end = data?.current_period_end;
  if (end == null || !Number.isFinite(Number(end))) return null;
  return new Date(Number(end) * 1000).toISOString();
}

export async function createStripeCheckout(
  env,
  clientReferenceId,
  { fetchImpl = fetch, percentOff = null, origin: originOpt = null, plan = 'monthly' } = {}
) {
  if (!stripeConfigured(env)) return { error: 'stripe_not_configured' };
  const origin =
    String(originOpt || '').trim() ||
    String(env.PREMIUM_SUCCESS_URL || '').trim() ||
    'https://houdini-analytics.pages.dev';
  const planKey = normalizeStripePlan(plan);
  const priceId = resolveStripePriceId(env, planKey);
  if (!priceId) return { error: 'stripe_price_missing' };
  let couponId = null;
  const pct = percentOff != null ? Math.round(Number(percentOff) || 0) : 0;
  if (pct > 0) {
    // Subscription Checkout: discounts[0][coupon] only — no price_data/unit_amount overrides.
    const coupon = await resolveStripePercentCoupon(env, pct, { fetchImpl });
    if (!coupon.id) return coupon;
    couponId = coupon.id;
  }
  // STRIPE_COUPON_FIRST_MONTH unused with flat 7,99 € monthly (no intro offer).
  const res = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: stripeAuthHeaders(env),
    body: checkoutFormBody({
      clientReferenceId,
      origin,
      priceId,
      couponId,
      percentOff: pct > 0 ? pct : null,
      plan: planKey,
      mode: 'subscription',
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { error: `stripe_${res.status}`, detail: detail.slice(0, 300) };
  }
  const data = await res.json();
  return { url: data.url, sessionId: data.id, percentOff: pct > 0 ? pct : null, plan: planKey };
}

/**
 * Verify `Stripe-Signature` against the raw body.
 * Signed payload = `${timestamp}.${body}`; v1 entries are HMAC-SHA256.
 */
export async function verifyStripeSignature(rawBody, sigHeader, secret, at = new Date()) {
  if (!sigHeader || !secret || !rawBody) return false;
  let timestamp = null;
  const signatures = [];
  for (const part of String(sigHeader).split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') timestamp = value;
    else if (key === 'v1') signatures.push(value);
  }
  if (!timestamp || !signatures.length) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(at.getTime() / 1000 - ts) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = await hmacHex(`${timestamp}.${rawBody}`, secret);
  return signatures.some((sig) => safeEqual(expected, sig.toLowerCase()));
}

async function hmacHex(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function validSessionId(value) {
  return /^[0-9a-f]{32}$/.test(String(value || '')) ? String(value) : null;
}

function unixToIso(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

async function findPremiumIdByStripe(db, { subscriptionId = null, customerId = null, sessionId = null } = {}) {
  if (subscriptionId) {
    const row = await db.first(
      `SELECT id FROM premium_sessions WHERE stripe_subscription_id = ?1 LIMIT 1`,
      String(subscriptionId)
    );
    if (row?.id) return String(row.id);
  }
  if (sessionId) {
    const row = await db.first(
      `SELECT id FROM premium_sessions WHERE stripe_session_id = ?1 LIMIT 1`,
      String(sessionId)
    );
    if (row?.id) return String(row.id);
  }
  if (customerId) {
    const row = await db.first(
      `SELECT id FROM premium_sessions
       WHERE stripe_customer_id = ?1 AND active = 1
       ORDER BY COALESCE(premium_until, created_at) DESC
       LIMIT 1`,
      String(customerId)
    );
    if (row?.id) return String(row.id);
  }
  return null;
}

async function persistStripeIds(
  db,
  id,
  { sessionId = null, customerId = null, subscriptionId = null, amountTotal = null, currency = null } = {}
) {
  await db.run(
    `UPDATE premium_sessions
      SET stripe_session_id = COALESCE(?2, stripe_session_id),
          stripe_customer_id = COALESCE(?3, stripe_customer_id),
          stripe_subscription_id = COALESCE(?4, stripe_subscription_id),
          amount_total = COALESCE(?5, amount_total),
          currency = COALESCE(?6, currency)
    WHERE id = ?1`,
    id,
    sessionId,
    customerId,
    subscriptionId,
    amountTotal,
    currency
  );
}

async function clearPromoAfterGrant(db, premiumSessionId) {
  const premRow = await db.first(`SELECT user_id FROM premium_sessions WHERE id = ?1`, premiumSessionId);
  if (premRow?.user_id) {
    await clearPendingPromoDiscount(db, premRow.user_id).catch(() => {});
  }
}

/**
 * Apply a signed Stripe event to D1. Returns `{ applied, kind }`.
 * Subscriptions: sync `premium_until` from `current_period_end` (checkout + renewals).
 * Cancel / refund: clear `premium_until`.
 */
export async function applyStripeEvent(db, env, event, { fetchImpl = fetch } = {}) {
  const type = String(event?.type || '');

  if (type === 'checkout.session.completed') {
    const session = event?.data?.object || {};
    const ref = String(
      session.client_reference_id ||
        session.metadata?.houdini_session ||
        session.metadata?.token ||
        ''
    );
    const id = validSessionId(ref);
    if (!id) return { applied: false, kind: 'no_session_ref' };

    const plan = normalizeStripePlan(session.metadata?.plan || 'monthly');
    const mode = String(session.mode || 'subscription');
    const subId = session.subscription ? String(session.subscription) : null;
    const at = new Date(session.created ? session.created * 1000 : Date.now());

    let until = null;
    if (mode === 'subscription') {
      let periodEnd = null;
      if (subId) {
        periodEnd = await fetchSubscriptionPeriodEnd(env, subId, { fetchImpl });
      }
      if (periodEnd) {
        until = await setPremiumUntil(db, id, periodEnd);
      } else {
        until = await grantPremium(db, id, { days: planPeriodDays(plan, env), at });
      }
    } else {
      // Legacy one-shot Checkout (mode=payment) — keep days grant.
      const days = Math.max(1, Math.min(365, Number(env.PREMIUM_DAYS) || planPeriodDays(plan, env)));
      until = await grantPremium(db, id, { days, at });
    }
    if (!until) return { applied: false, kind: 'unknown_session' };

    await persistStripeIds(db, id, {
      sessionId: session.id ? String(session.id) : null,
      customerId: session.customer ? String(session.customer) : null,
      subscriptionId: subId,
      amountTotal: session.amount_total != null ? Number(session.amount_total) : null,
      currency: session.currency ? String(session.currency) : null,
    });
    await clearPromoAfterGrant(db, id);
    return { applied: true, kind: 'granted', until, id, plan, mode };
  }

  if (type === 'invoice.paid' || type === 'customer.subscription.updated') {
    const obj = event?.data?.object || {};
    const subId =
      type === 'invoice.paid'
        ? obj.subscription
          ? String(obj.subscription)
          : null
        : obj.id
          ? String(obj.id)
          : null;
    const customerId = obj.customer ? String(obj.customer) : null;
    const metaSession = validSessionId(obj.metadata?.houdini_session);
    let id =
      metaSession ||
      (await findPremiumIdByStripe(db, { subscriptionId: subId, customerId }));
    if (!id) return { applied: false, kind: 'no_session_ref' };

    if (type === 'customer.subscription.updated') {
      const status = String(obj.status || '');
      if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
        // Keep access until period end when Stripe still reports one; else revoke.
        const endIso = unixToIso(obj.current_period_end);
        if (endIso && Date.parse(endIso) > Date.now() && status !== 'incomplete_expired') {
          const until = await setPremiumUntil(db, id, endIso);
          await persistStripeIds(db, id, { subscriptionId: subId, customerId });
          return { applied: true, kind: 'synced', until, id };
        }
        await db.run(`UPDATE premium_sessions SET premium_until = NULL WHERE id = ?1`, id);
        return { applied: true, kind: 'revoked', id, status };
      }
    }

    let periodEnd = unixToIso(obj.current_period_end);
    if (!periodEnd && type === 'invoice.paid') {
      const lineEnd = obj.lines?.data?.[0]?.period?.end;
      periodEnd = unixToIso(lineEnd);
    }
    if (!periodEnd && subId) {
      periodEnd = await fetchSubscriptionPeriodEnd(env, subId, { fetchImpl });
    }
    if (!periodEnd) {
      const plan = normalizeStripePlan(obj.metadata?.plan || 'monthly');
      periodEnd = await grantPremium(db, id, { days: planPeriodDays(plan, env) });
    } else {
      periodEnd = await setPremiumUntil(db, id, periodEnd);
    }
    if (!periodEnd) return { applied: false, kind: 'unknown_session' };
    await persistStripeIds(db, id, { subscriptionId: subId, customerId });
    return { applied: true, kind: 'synced', until: periodEnd, id };
  }

  if (type === 'customer.subscription.deleted') {
    const sub = event?.data?.object || {};
    const subId = sub.id ? String(sub.id) : null;
    const customerId = sub.customer ? String(sub.customer) : null;
    const metaSession = validSessionId(sub.metadata?.houdini_session);
    const id =
      metaSession ||
      (await findPremiumIdByStripe(db, { subscriptionId: subId, customerId }));
    if (!id) return { applied: false, kind: 'no_session_ref' };
    await db.run(`UPDATE premium_sessions SET premium_until = NULL WHERE id = ?1`, id);
    return { applied: true, kind: 'revoked', id, subscriptionId: subId };
  }

  if (type === 'charge.refunded') {
    const charge = event?.data?.object || {};
    const sessionId = charge.checkout?.session ? String(charge.checkout.session) : null;
    if (sessionId) {
      await db.run(
        `UPDATE premium_sessions SET premium_until = NULL WHERE stripe_session_id = ?1`,
        sessionId
      );
      return { applied: true, kind: 'revoked', sessionId };
    }
    const customerId = charge.customer ? String(charge.customer) : null;
    if (customerId) {
      await db.run(
        `UPDATE premium_sessions SET premium_until = NULL WHERE stripe_customer_id = ?1`,
        customerId
      );
      return { applied: true, kind: 'revoked', customerId };
    }
    return { applied: false, kind: 'no_session_id' };
  }

  return { applied: false, kind: 'ignored', type };
}

/* ------------------------------------------------------------------ *
 * Promo codes
 * ------------------------------------------------------------------ */

export const PROMO_TYPES = Object.freeze({
  FREE_DAYS: 'free_days',
  FREE_MONTH: 'free_month',
  DISCOUNT_20: 'discount_20',
  DISCOUNT_40: 'discount_40',
});

const PROMO_TYPE_SET = new Set(Object.values(PROMO_TYPES));
const FREE_MONTH_DAYS = 30;

function normalizePromoCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function normalizePromoType(raw) {
  const t = String(raw || '')
    .trim()
    .toLowerCase();
  if (PROMO_TYPE_SET.has(t)) return t;
  return null;
}

export function promoPercentForType(type) {
  if (type === PROMO_TYPES.DISCOUNT_20) return 20;
  if (type === PROMO_TYPES.DISCOUNT_40) return 40;
  return null;
}

export function isDiscountPromoType(type) {
  return type === PROMO_TYPES.DISCOUNT_20 || type === PROMO_TYPES.DISCOUNT_40;
}

export async function getPendingPromoDiscount(db, userId) {
  if (!userId) return { percent: null, code: null };
  const row = await db
    .first(
      `SELECT pending_promo_percent AS percent, pending_promo_code AS code
       FROM users WHERE id = ?1`,
      String(userId)
    )
    .catch(() => null);
  const percent = row?.percent != null ? Number(row.percent) : null;
  if (!Number.isFinite(percent) || percent <= 0) return { percent: null, code: null };
  return { percent, code: row?.code ? String(row.code) : null };
}

export async function setPendingPromoDiscount(db, userId, { percent, code }) {
  const uid = String(userId);
  const pct = Math.max(1, Math.min(100, Math.round(Number(percent) || 0)));
  await db.run(
    `UPDATE users
     SET pending_promo_percent = ?2, pending_promo_code = ?3, updated_at = ?4
     WHERE id = ?1`,
    uid,
    pct,
    code ? String(code) : null,
    nowIso()
  );
  return { percent: pct, code: code ? String(code) : null };
}

export async function clearPendingPromoDiscount(db, userId) {
  if (!userId) return;
  await db.run(
    `UPDATE users
     SET pending_promo_percent = NULL, pending_promo_code = NULL, updated_at = ?2
     WHERE id = ?1`,
    String(userId),
    nowIso()
  );
}

function resolvePromoDays(type, daysRaw) {
  if (type === PROMO_TYPES.FREE_MONTH) return FREE_MONTH_DAYS;
  if (isDiscountPromoType(type)) return 0;
  return Math.max(1, Math.min(365, Number(daysRaw) || 0));
}

export async function listPromoCodes(db) {
  const rows = await db.all(
    `SELECT code, type, days, max_redemptions AS maxRedemptions, redeemed_count AS redeemedCount,
            active, expires_at AS expiresAt, created_at AS createdAt
     FROM promo_codes
     ORDER BY created_at DESC`
  );
  return (rows || []).map((r) => ({
    ...r,
    type: normalizePromoType(r.type) || PROMO_TYPES.FREE_DAYS,
  }));
}

export async function createPromoCode(
  db,
  { code, type = PROMO_TYPES.FREE_DAYS, days, maxRedemptions = null, expiresAt = null } = {}
) {
  const normalized = normalizePromoCode(code);
  const promoType = normalizePromoType(type) || PROMO_TYPES.FREE_DAYS;
  if (!normalized || normalized.length < 3) {
    return { error: 'invalid_code', message: 'Código inválido' };
  }
  const d = resolvePromoDays(promoType, days);
  if (promoType === PROMO_TYPES.FREE_DAYS && !d) {
    return { error: 'invalid_days', message: 'Días inválidos' };
  }
  const existing = await db.first(`SELECT code FROM promo_codes WHERE code = ?1`, normalized);
  if (existing) return { error: 'exists', message: 'El código ya existe' };
  const max =
    maxRedemptions == null || maxRedemptions === ''
      ? null
      : Math.max(1, Math.min(100000, Number(maxRedemptions) || 0)) || null;
  await db.run(
    `INSERT INTO promo_codes
      (code, type, days, max_redemptions, redeemed_count, active, expires_at, created_at)
     VALUES (?1, ?2, ?3, ?4, 0, 1, ?5, ?6)`,
    normalized,
    promoType,
    d,
    max,
    expiresAt ? String(expiresAt) : null,
    nowIso()
  );
  return {
    ok: true,
    code: normalized,
    type: promoType,
    days: d,
    maxRedemptions: max,
  };
}

/**
 * Soft-delete: active=0 (keeps redemptions history).
 */
export async function deletePromoCode(db, rawCode) {
  const code = normalizePromoCode(rawCode);
  if (!code) return { error: 'invalid_code', message: 'Código no válido' };
  const row = await db.first(`SELECT code, active FROM promo_codes WHERE code = ?1`, code);
  if (!row) return { error: 'not_found', message: 'Código no encontrado' };
  if (Number(row.active) === 0) return { ok: true, code, alreadyInactive: true };
  await db.run(`UPDATE promo_codes SET active = 0 WHERE code = ?1`, code);
  return { ok: true, code, softDeleted: true };
}

/**
 * Shared promo validity checks (no writes). Used by redeem + guest preview.
 * @returns {{ ok: true, row, type } | { error, message }}
 */
async function loadValidPromoRow(db, rawCode, { userId = null } = {}) {
  const code = normalizePromoCode(rawCode);
  if (!code) return { error: 'invalid_code', message: 'Código no válido' };

  const row = await db.first(`SELECT * FROM promo_codes WHERE code = ?1`, code);
  if (!row || Number(row.active) !== 1) {
    return { error: 'invalid_code', message: 'Código no válido' };
  }
  if (row.expires_at) {
    const exp = Date.parse(row.expires_at);
    if (Number.isFinite(exp) && exp < Date.now()) {
      return { error: 'expired', message: 'Código agotado o caducado' };
    }
  }
  if (row.max_redemptions != null && Number(row.redeemed_count) >= Number(row.max_redemptions)) {
    return { error: 'exhausted', message: 'Código agotado o caducado' };
  }

  const uid = userId ? String(userId) : '';
  if (uid) {
    const prior = await db.first(
      `SELECT id FROM promo_redemptions WHERE code = ?1 AND user_id = ?2`,
      code,
      uid
    );
    if (prior) return { error: 'already_used', message: 'Ya has usado este código' };
  }

  const type = normalizePromoType(row.type) || PROMO_TYPES.FREE_DAYS;
  return { ok: true, row, type, code };
}

/**
 * Preview a promo without redeeming (guests + pre-checkout).
 * discount_* → percentOff for UI/checkout; free_* → days + needsAuth hint.
 */
export async function previewPromoCode(db, rawCode, { userId = null } = {}) {
  const loaded = await loadValidPromoRow(db, rawCode, { userId });
  if (!loaded.ok) return { error: loaded.error, message: loaded.message };

  const { type, code, row } = loaded;
  if (isDiscountPromoType(type)) {
    const percent = promoPercentForType(type);
    return {
      ok: true,
      code,
      type,
      kind: 'discount',
      percentOff: percent,
      days: null,
      needsAuth: false,
    };
  }

  const days =
    type === PROMO_TYPES.FREE_MONTH
      ? FREE_MONTH_DAYS
      : Math.max(1, Math.min(365, Number(row.days) || 1));
  return {
    ok: true,
    code,
    type,
    kind: 'grant',
    percentOff: null,
    days,
    needsAuth: !userId,
  };
}

/**
 * Redeem a promo code for a logged-in user.
 * free_days / free_month → grantPremiumForUser
 * discount_* → pending checkout discount on user
 * @returns {{ ok: true, ... } | { error, message }}
 */
export async function redeemPromoCode(db, userId, rawCode) {
  const uid = String(userId || '');
  if (!uid) return { error: 'auth_required', message: 'Inicia sesión para canjear' };

  const loaded = await loadValidPromoRow(db, rawCode, { userId: uid });
  if (!loaded.ok) return { error: loaded.error, message: loaded.message };

  const { type, code, row } = loaded;
  const redemptionId = randomHex(16);
  await db.run(
    `INSERT INTO promo_redemptions (id, code, user_id, created_at) VALUES (?1, ?2, ?3, ?4)`,
    redemptionId,
    code,
    uid,
    nowIso()
  );
  await db.run(
    `UPDATE promo_codes SET redeemed_count = redeemed_count + 1 WHERE code = ?1`,
    code
  );

  if (isDiscountPromoType(type)) {
    const percent = promoPercentForType(type);
    await setPendingPromoDiscount(db, uid, { percent, code });
    return {
      ok: true,
      code,
      type,
      percentOff: percent,
      days: null,
      premiumUntil: null,
      kind: 'discount',
    };
  }

  const days =
    type === PROMO_TYPES.FREE_MONTH
      ? FREE_MONTH_DAYS
      : Math.max(1, Math.min(365, Number(row.days) || 1));
  const granted = await grantPremiumForUser(db, uid, { days });
  return {
    ok: true,
    code,
    type,
    days,
    premiumUntil: granted.premiumUntil,
    percentOff: null,
    kind: 'grant',
  };
}

/* ------------------------------------------------------------------ *
 * Gating helpers
 * ------------------------------------------------------------------ */

/**
 * Performance payload for free visitors: basic counts stay public, the
 * money view (ROI) and the deeper combo history are premium.
 */
export function stripPerfForFree(perf) {
  if (!perf || typeof perf !== 'object') return perf;
  const free = { ...perf, premiumRequired: true };
  delete free.roi;
  delete free.roiByFamily;
  delete free.recentCombos;
  delete free.recent;
  free.byFamily = (free.byFamily || []).map((row) => {
    const rest = { ...row };
    delete rest.roi;
    return rest;
  });
  return free;
}
