/**
 * Canonical tip universe for primary tips / Top 10 / Aciertos day-results.
 * Selection ranks by model P only — no book odds / cuota gates.
 */

import { modelProbForBet } from './oddsBands.js';

/** Inclusive playable + Top 10 / Aciertos band (percent). */
export const TIP_MIN_PROB_PCT = 78;
export const TIP_MAX_PROB_PCT = 95;
export const TIP_MIN_PROB = TIP_MIN_PROB_PCT / 100;
export const TIP_MAX_PROB = TIP_MAX_PROB_PCT / 100;

/**
 * Allowlisted market codes (primary tip candidates).
 * Team totals HOME_/AWAY_OVER_15|25 are included when the goals model computes them.
 * CORNERS_OVER_75 requires the corners Poisson tip line (added alongside this module).
 */
export const TIP_MARKET_CODES = Object.freeze([
  'OVER_15',
  'HOME_OVER_15',
  'AWAY_OVER_15',
  'OVER_25',
  'HOME_OVER_25',
  'AWAY_OVER_25',
  'BTTS_YES',
  'DC_1X',
  'DC_X2',
  'CARDS_OVER_35',
  'CORNERS_OVER_75',
  'SOT_OVER_75',
]);

export const TIP_MARKET_SET = new Set(TIP_MARKET_CODES);

/** Ultra-safe / banned lines — never tip (SHOTS_* total shots also banned). */
export const TIP_TRIVIAL_LABELS = new Set(['OVER_05', 'UNDER_45']);

/** camelCase flat fields (matches/today) → snake_case prediction columns. */
const CAMEL_TO_SNAKE_PROB = Object.freeze({
  homeWinProb: 'home_win_prob',
  drawProb: 'draw_prob',
  awayWinProb: 'away_win_prob',
  over15Prob: 'over15_prob',
  under15Prob: 'under15_prob',
  over25Prob: 'over25_prob',
  under25Prob: 'under25_prob',
  bttsYesProb: 'btts_yes_prob',
  bttsNoProb: 'btts_no_prob',
  homeOver15Prob: 'home_over15_prob',
  homeOver25Prob: 'home_over25_prob',
  awayOver15Prob: 'away_over15_prob',
  awayOver25Prob: 'away_over25_prob',
  cornersOver75Prob: 'corners_over75_prob',
  cornersUnder75Prob: 'corners_under75_prob',
  cardsOver35Prob: 'cards_over35_prob',
  cardsUnder35Prob: 'cards_under35_prob',
  sotOver75Prob: 'sot_over75_prob',
  sotUnder75Prob: 'sot_under75_prob',
});

export function isTipMarket(code) {
  return TIP_MARKET_SET.has(String(code || '').toUpperCase());
}

export function isBannedShotTotalLabel(label) {
  return String(label || '')
    .toUpperCase()
    .startsWith('SHOTS_');
}

export function isTrivialTipLabel(label) {
  const lab = String(label || '').toUpperCase();
  return TIP_TRIVIAL_LABELS.has(lab) || isBannedShotTotalLabel(lab);
}

/**
 * Diversity families mapped to the allowlisted tip set.
 * DC stays separate from 1X2 singles (which are no longer tip markets).
 */
export function tipFamilyUi(code) {
  const b = String(code || '').toUpperCase();
  if (b === 'DC_1X' || b === 'DC_X2') return 'dc';
  if (b === 'BTTS_YES') return 'btts';
  if (
    b === 'OVER_15' ||
    b === 'OVER_25' ||
    b === 'HOME_OVER_15' ||
    b === 'HOME_OVER_25' ||
    b === 'AWAY_OVER_15' ||
    b === 'AWAY_OVER_25'
  ) {
    return 'ou';
  }
  if (b.startsWith('CORNERS_')) return 'corners';
  if (b.startsWith('CARDS_')) return 'cards';
  if (b.startsWith('SOT_')) return 'shots_on_target';
  return 'other';
}

/** True when P (0–1 or 0–100) sits in the tip band. */
export function tipProbInBand(prob, { min = TIP_MIN_PROB_PCT, max = TIP_MAX_PROB_PCT } = {}) {
  let p = Number(prob);
  if (!Number.isFinite(p) || p <= 0) return false;
  if (p <= 1) p *= 100;
  return p >= min && p <= max;
}

/**
 * Normalize enriched match rows (camelCase) or prediction rows (snake_case)
 * so modelProbForBet can resolve allowlisted markets.
 */
export function coercePredictionProbRow(row) {
  if (!row || typeof row !== 'object') return null;
  const out = { ...row };
  for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE_PROB)) {
    if (out[snake] == null && out[camel] != null) out[snake] = out[camel];
  }
  return out;
}

/**
 * Best allowlisted tip in the playable band from stored model probs.
 * Uses truncated % (same as Top 10 UI) so 95.6% → 95 stays in-band.
 * Prefer this over stale predictions.suggested_bet when building Top 10 / day-results.
 *
 * @returns {{ label: string, prob: number, probPct: number }|null}
 */
export function pickPlayablePrimaryFromProbs(
  predictionRow,
  { minPct = TIP_MIN_PROB_PCT, maxPct = TIP_MAX_PROB_PCT } = {}
) {
  const row = coercePredictionProbRow(predictionRow);
  if (!row) return null;
  let best = null;
  for (const code of TIP_MARKET_CODES) {
    if (isTrivialTipLabel(code)) continue;
    const raw = modelProbForBet(row, code);
    if (raw == null || !Number.isFinite(raw) || raw <= 0) continue;
    const unit = raw > 1 ? raw / 100 : raw;
    const probPct = Math.trunc(unit * 100);
    if (probPct < minPct || probPct > maxPct) continue;
    if (
      !best ||
      probPct > best.probPct ||
      (probPct === best.probPct && unit > best.prob)
    ) {
      best = { label: code, prob: unit, probPct };
    }
  }
  return best;
}
