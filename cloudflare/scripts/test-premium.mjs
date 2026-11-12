/** Tests for the F8 premium layer: guest session, Stripe webhook, gating. */
import * as prem from '../src/services/premiumService.js';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(resolve(HERE, '../public/app.js'), 'utf8');
const INDEX = readFileSync(resolve(HERE, '../src/index.js'), 'utf8');

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`ok   ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL ${label}`);
  }
}

/* ------------------------------------------------------------ mock db */
function mockDb() {
  const state = { rows: [], updates: [] };
  const find = (id) => state.rows.find((r) => r.id === id);
  return {
    state,
    find,
    async run(sql, ...params) {
      state.updates.push(sql);
      const [p1, p2, p3, p4, p5, p6] = params;
      if (/INSERT INTO premium_sessions/.test(sql)) {
        state.rows.push({
          id: p1,
          token_hash: p2,
          active: 1,
          premium_until: p3,
          created_at: p4,
        });
      } else if (/SET premium_until = \?2/.test(sql)) {
        const row = find(p1);
        if (row) row.premium_until = p2;
      } else if (/SET active = 0/.test(sql)) {
        const row = find(p1);
        if (row) row.active = 0;
      } else if (/SET premium_until = NULL/.test(sql)) {
        if (/WHERE id = \?1/.test(sql)) {
          const row = find(p1);
          if (row) row.premium_until = null;
        } else if (/stripe_customer_id = \?1/.test(sql)) {
          state.rows.filter((r) => r.stripe_customer_id === p1).forEach((r) => {
            r.premium_until = null;
          });
        } else {
          state.rows.filter((r) => r.stripe_session_id === p1).forEach((r) => {
            r.premium_until = null;
          });
        }
      } else if (/stripe_session_id/.test(sql) && /UPDATE premium_sessions/.test(sql)) {
        const row = find(p1);
        if (row) {
          if (p2 != null) row.stripe_session_id = p2;
          if (p3 != null) row.stripe_customer_id = p3;
          if (p4 != null) row.stripe_subscription_id = p4;
          if (p5 != null) row.amount_total = p5;
          if (p6 != null) row.currency = p6;
        }
      }
    },
    async first(sql, ...params) {
      if (/stripe_subscription_id = \?1/.test(sql)) {
        return state.rows.find((r) => r.stripe_subscription_id === params[0]) || null;
      }
      if (/stripe_session_id = \?1/.test(sql)) {
        return state.rows.find((r) => r.stripe_session_id === params[0]) || null;
      }
      if (/stripe_customer_id = \?1/.test(sql)) {
        return state.rows.find((r) => r.stripe_customer_id === params[0]) || null;
      }
      if (/WHERE id = \?1/.test(sql)) return find(params[0]) || null;
      return null;
    },
  };
}

/* --------------------------------------------------------- guest sessions */
const db = mockDb();
const created = await prem.createPremiumSession(db);
check('a guest session id is a 32-char hex', created.id.length === 32);
check('the cookie carries id.secret', created.cookieValue === `${created.id}.${created.cookieValue.split('.')[1]}`);

const { session, premium } = await prem.resolvePremiumSession(db, created.cookieValue);
check('a brand-new session resolves and is not premium',
  session?.id === created.id && premium === false);

const cookieAgo = prem.sessionCookieFromHeader('a=b; hb_prem=zz; tik=tak; hb_prem=%2Fx');
check('the cookie header parsing keeps the last hb_prem', cookieAgo === '/x');

const tampered = await prem.resolvePremiumSession(db, `${created.id}.${'f'.repeat(64)}`);
check('a wrong token deactivates the session', tampered.premium === false && db.find(created.id).active === 0);

db.find(created.id).active = 1;
db.find(created.id).premium_until = new Date(Date.now() - 1000).toISOString();
const expired = await prem.resolvePremiumSession(db, created.cookieValue);
check('an expired session is not premium', Boolean(expired.session) && expired.expired !== undefined ? expired.premium === false : expired.premium === false);

const granted = await prem.grantPremium(db, created.id, { days: 30 });
const grantedMs = Date.parse(granted);
check('grant sets an expiry about 30 days out',
  granted && grantedMs > Date.now() + 29 * 24 * 3600e3 && grantedMs < Date.now() + 31.1 * 24 * 3600e3);

const later = await prem.grantPremium(db, created.id, { days: 7, at: new Date(grantedMs + 10 * 24 * 3600e3) });
check('a second grant stacks on the remaining days',
  Date.parse(later) > Date.parse(granted) + 6.9 * 24 * 3600e3);

const again = await prem.resolvePremiumSession(db, created.cookieValue);
check('a paid session resolves as premium', again.premium === true);

/* --------------------------------------------------------------- stripe */
check('stripe checkout without keys reports not configured',
  prem.stripeConfigured({}) === false && prem.stripeConfigured(null) === false);
check('checkout needs key and price',
  prem.stripeConfigured({ STRIPE_SECRET_KEY: 'sk_x', STRIPE_PRICE_ID_MONTHLY: 'price_m' }) === true);
check('price resolver maps monthly/quarterly/annual',
  prem.resolveStripePriceId(
    {
      STRIPE_PRICE_ID_MONTHLY: 'price_m',
      STRIPE_PRICE_ID_QUARTERLY: 'price_q',
      STRIPE_PRICE_ID_ANNUAL: 'price_a',
    },
    'quarterly'
  ) === 'price_q' &&
    prem.resolveStripePriceId(
      { STRIPE_PRICE_ID_MONTHLY: 'price_m', STRIPE_PRICE_ID_ANNUAL: 'price_a' },
      'annual'
    ) === 'price_a');

const body = prem.checkoutFormBody({
  clientReferenceId: created.id,
  origin: 'https://houdini-bet.dev',
  priceId: 'price_123',
  plan: 'monthly',
});
check('the checkout body is subscription mode with the session reference',
  typeof body === 'string' &&
    body.includes('mode=subscription') &&
    body.includes(`client_reference_id=${created.id}`) &&
    body.includes('line_items%5B0%5D%5Bprice%5D=price_123') &&
    body.includes('metadata%5Bplan%5D=monthly') &&
    body.includes('success_url=https%3A%2F%2Fhoudini-bet.dev%2F%3Fpremium%3Dok'));

const WEBHOOK_SECRET = 'whsec_test_123';
const eventPayload = JSON.stringify({
  id: 'evt_1',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_1',
      mode: 'subscription',
      client_reference_id: created.id,
      created: Math.floor(Date.now() / 1000),
      amount_total: 499,
      currency: 'eur',
      customer: 'cus_1',
      subscription: 'sub_1',
      metadata: { plan: 'monthly' },
    },
  },
});
const t = Math.floor(Date.now() / 1000);
const signedPayload = `${t}.${eventPayload}`;
const v1 = createHmac('sha256', WEBHOOK_SECRET).update(signedPayload).digest('hex');
const sigHeader = `t=${t},v1=${v1}`;
const validSig = await prem.verifyStripeSignature(eventPayload, sigHeader, WEBHOOK_SECRET);
check('a correctly signed webhook verifies', validSig === true);
const tamperBody = await prem.verifyStripeSignature(
  eventPayload.replace('499', '999'),
  sigHeader,
  WEBHOOK_SECRET
);
check('a tampered payload fails the signature', tamperBody === false);
const stale = await prem.verifyStripeSignature(
  eventPayload,
  `t=${t - 3600},v1=${createHmac('sha256', WEBHOOK_SECRET).update(`${t - 3600}.${eventPayload}`).digest('hex')}`,
  WEBHOOK_SECRET
);
check('a webhook older than the tolerance is rejected', stale === false);
const noSig = await prem.verifyStripeSignature(eventPayload, null, WEBHOOK_SECRET);
check('a webhook without a header is rejected', noSig === false);

const fakeFetch = async (url) => {
  if (String(url).includes('/v1/subscriptions/sub_1')) {
    return {
      ok: true,
      async json() {
        return { id: 'sub_1', current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 };
      },
    };
  }
  return { ok: false, async text() { return ''; }, async json() { return {}; } };
};

const applied = await prem.applyStripeEvent(
  db,
  { PREMIUM_DAYS: 30, STRIPE_SECRET_KEY: 'sk_test' },
  JSON.parse(eventPayload),
  { fetchImpl: fakeFetch }
);
check('checkout completed grants from subscription period',
  applied.applied === true && applied.kind === 'granted' && db.find(created.id).stripe_subscription_id === 'sub_1');

const badRef = await prem.applyStripeEvent(db, { PREMIUM_DAYS: 30 }, {
  type: 'checkout.session.completed',
  data: { object: { client_reference_id: 'not-a-token' } },
});
check('a webhook with an unknown reference does not grant', badRef.kind === 'no_session_ref');

const renewed = await prem.applyStripeEvent(
  db,
  { STRIPE_SECRET_KEY: 'sk_test' },
  {
    type: 'invoice.paid',
    data: {
      object: {
        subscription: 'sub_1',
        customer: 'cus_1',
        lines: { data: [{ period: { end: Math.floor(Date.now() / 1000) + 60 * 86400 } }] },
      },
    },
  }
);
check('invoice.paid renews premium_until from period end',
  renewed.applied === true && renewed.kind === 'synced');

const canceled = await prem.applyStripeEvent(db, {}, {
  type: 'customer.subscription.deleted',
  data: { object: { id: 'sub_1', customer: 'cus_1' } },
});
check('subscription deleted revokes premium',
  canceled.applied === true && db.find(created.id).premium_until === null);

const refund = await prem.applyStripeEvent(db, { PREMIUM_DAYS: 30 }, {
  type: 'charge.refunded',
  data: { object: { checkout: { session: 'cs_1' } } },
});
check('a refund revokes the associated session', refund.applied === true && db.find(created.id).premium_until === null);

const ignored = await prem.applyStripeEvent(db, { PREMIUM_DAYS: 30 }, {
  type: 'payment_intent.succeeded',
  data: { object: {} },
});
check('unrelated stripe events are ignored', ignored.applied === false && ignored.kind === 'ignored');

check('API accepts quarterly/annual plan keys',
  INDEX.includes('normalizeStripePlan(body?.plan') &&
    APP.includes("'quarterly'") &&
    APP.includes("'annual'"));

/* ---------------------------------------------------------------- gating */
const perf = {
  hits: 4, misses: 3, pending: 2, voids: 1, decided: 7, hitRate: 0.571,
  roi: { staked: 7, yield: 0.12, hits: 4, misses: 3 },
  roiByFamily: { btts: { yield: 0.2 } },
  recentCombos: [{ legs: [] }],
  recent: [{ suggestedBet: 'BTTS_YES' }],
  byFamily: [{ family: 'btts', hits: 2, misses: 1, roi: 0.2 }, { family: '1x2', hits: 2, misses: 2, roi: -0.1 }],
};
const gated = prem.stripPerfForFree(perf);
check('the free performance view drops the money data',
  gated.roi === undefined && gated.roiByFamily === undefined &&
    gated.recentCombos === undefined && gated.recent === undefined);
check('the free performance view keeps the counts and flags the gate',
  gated.hits === 4 && gated.hitRate === 0.571 && gated.premiumRequired === true);
check('the free performance view hides roi inside byFamily rows',
  gated.byFamily.every((r) => r.roi === undefined) && gated.byFamily[0].hits === 2);
check('the source perf object is not mutated', perf.roi !== undefined && perf.recent.length === 1);

/* ---------------------------------------------------------------- wiring */
check('best-bets returns 402 for the band combos without premium',
  INDEX.includes('premiumRequiredResponse()') && INDEX.includes('if (oddsBand)'));
check('performance strips itself for free visitors',
  INDEX.includes('premium ? payload : premiumService.stripPerfForFree(payload)'));
check('the webhook route verifies the signature before applying',
  INDEX.includes('/api/v1/premium/webhook') && INDEX.includes('verifyStripeSignature'));
check('an admin grant endpoint exists behind the sync secret',
  INDEX.includes('/api/v1/admin/premium/grant') && INDEX.includes('x-sync-secret'));
check('the session route sets the guest cookie when absent',
  INDEX.includes("'set-cookie': setCookie") && INDEX.includes('createPremiumSession(db)'));
check('the checkout success url uses premiumCheckoutOrigin (not workers.dev proxy)',
  INDEX.includes('premiumCheckoutOrigin(request, env)') &&
    INDEX.includes('function premiumCheckoutOrigin'));

check('the band loader shows the upsell on premium_required',
  APP.includes("err.code === 'premium_required'") && APP.includes('premiumUpsellHtml(`banda-'));
check('the api wrapper carries the error code', APP.includes('data.errorCode'));
check('the perf roi block is premium aware',
  APP.includes('perfRoiHtml(perf)') && APP.includes('perf-roi--premium') && APP.includes('premiumState.premium'));
check('the boot reads the premium state and the stripe return',
  APP.includes('await handlePremiumReturn()') && APP.includes('await loadPremiumState()'));
check('the premium view CTA is driven by the real state',
  APP.includes('syncPremiumView') && APP.includes("document.getElementById('premium-cta')"));

console.log(failed ? `\n${failed} checks failed` : `\n${passed}/${passed} checks passed`);
process.exit(failed ? 1 : 0);
