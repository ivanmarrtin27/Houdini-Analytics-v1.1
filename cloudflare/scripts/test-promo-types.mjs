/**
 * Smoke: promo type helpers + checkout form body with coupon + preview export.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROMO_TYPES,
  normalizePromoType,
  promoPercentForType,
  isDiscountPromoType,
  checkoutFormBody,
  houdiniPercentCouponId,
  previewPromoCode,
} from '../src/services/premiumService.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = readFileSync(resolve(HERE, '../src/index.js'), 'utf8');
const APP = readFileSync(resolve(HERE, '../public/app.js'), 'utf8');
const PAGES_APP = readFileSync(resolve(HERE, '../pages/app.js'), 'utf8');
const HTML = readFileSync(resolve(HERE, '../public/index.html'), 'utf8');

assert.equal(normalizePromoType('FREE_MONTH'), PROMO_TYPES.FREE_MONTH);
assert.equal(normalizePromoType('discount_20'), PROMO_TYPES.DISCOUNT_20);
assert.equal(normalizePromoType('nope'), null);

assert.equal(promoPercentForType(PROMO_TYPES.DISCOUNT_20), 20);
assert.equal(promoPercentForType(PROMO_TYPES.DISCOUNT_40), 40);
assert.equal(promoPercentForType(PROMO_TYPES.FREE_MONTH), null);
assert.equal(isDiscountPromoType(PROMO_TYPES.DISCOUNT_40), true);
assert.equal(isDiscountPromoType(PROMO_TYPES.FREE_DAYS), false);
assert.equal(typeof previewPromoCode, 'function');

const plain = checkoutFormBody({
  clientReferenceId: 'abc',
  origin: 'https://houdini-bet.pages.dev',
  priceId: 'price_x',
});
assert.match(plain, /allow_promotion_codes=true/);
assert.doesNotMatch(plain, /discounts/);

const withCoupon = checkoutFormBody({
  clientReferenceId: 'abc',
  origin: 'https://houdini-bet.pages.dev',
  priceId: 'price_x',
  couponId: 'coup_1',
  percentOff: 20,
});
assert.match(withCoupon, /discounts%5B0%5D%5Bcoupon%5D=coup_1|discounts\[0\]\[coupon\]=coup_1/);
assert.doesNotMatch(withCoupon, /allow_promotion_codes=true/);
assert.match(withCoupon, /pending_promo_percent/);
assert.match(withCoupon, /mode=subscription/);
assert.match(withCoupon, /managed_payments/);
assert.equal(houdiniPercentCouponId(40), 'houdini_pct_40_once');
assert.equal(houdiniPercentCouponId(20), 'houdini_pct_20_once');

assert.match(INDEX, /\/api\/v1\/premium\/promo\/preview/);
assert.match(INDEX, /previewPromoCode/);
assert.match(HTML, /id="premium-coupon"/);
assert.match(HTML, /id="premium-promo-btn"/);
assert.match(APP, /function applyPremiumPromo/);
assert.match(APP, /PROMO_SESSION_KEY/);
assert.match(APP, /promoCode/);
assert.equal(APP.includes('function applyPremiumPromo'), PAGES_APP.includes('function applyPremiumPromo'));

console.log('test-promo-types: ok');
