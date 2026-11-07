/**
 * Top 10 tip selection (same rules as public `#top3` client + day-results).
 * Allowlisted markets only; P 78–95% desc; no cuota/odds gates; primary only;
 * anti-trivial; family diversity. Never SHOTS_*.
 */

import {
  TIP_MIN_PROB_PCT,
  TIP_MAX_PROB_PCT,
  isTipMarket,
  isTrivialTipLabel,
  tipFamilyUi,
  pickPlayablePrimaryFromProbs,
} from './tipMarkets.js';

export const TOP10_MIN_PROB = TIP_MIN_PROB_PCT;
export const TOP10_MAX_PROB = TIP_MAX_PROB_PCT;
export const TOP10_MAX_PER_FAMILY = 3;
export const TOP10_LIMIT = 10;
export { tipFamilyUi, isTrivialTipLabel as isTrivialTop10Label };

export function formatTipPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

/**
 * @param {{ tipMarketProb?: number|null, confidenceScore?: number|null }} raw
 * @returns {number|null} 0–100 truncated
 */
export function tipProbPct(raw) {
  if (!raw) return null;
  const tipMarket = raw.tipMarketProb ?? raw.tip_market_prob;
  if (tipMarket != null && !Number.isNaN(Number(tipMarket))) {
    const n = Number(tipMarket);
    if (n > 0) return formatTipPct(n <= 1 ? n * 100 : n);
  }
  const confRaw = raw.confidenceScore ?? raw.conf ?? raw.confidence_score;
  const conf = confRaw != null && !Number.isNaN(Number(confRaw)) ? Number(confRaw) : null;
  return conf != null && conf > 0 ? formatTipPct(conf) : null;
}

/**
 * Top 10 eligibility: allowlisted + non-trivial + P in [minProb, TOP10_MAX_PROB].
 * Rank score = model P only (no book odds / edge).
 */
export function tipPlayableScore(m, minProb = TOP10_MIN_PROB) {
  const tip = m?.suggestedBet || m?.tip || m?.suggested_bet || '';
  if (!tip || !isTipMarket(tip) || isTrivialTipLabel(tip)) return null;
  const prob = tipProbPct(m);
  if (
    prob == null ||
    !Number.isFinite(Number(prob)) ||
    Number(prob) < minProb ||
    Number(prob) > TOP10_MAX_PROB
  ) {
    return null;
  }
  return {
    score: Number(prob) / 100,
    kind: 'est',
    prob: Number(prob),
  };
}

export function isTop10MatchStatus(status, { includeFinished = false } = {}) {
  const s = String(status || '').toLowerCase();
  if (s === 'scheduled' || s === 'live' || s === '') return true;
  // Day board grades FT + voids postponed/cancelled; live Top 10 skips both.
  if (includeFinished && (s === 'finished' || s === 'postponed' || s === 'cancelled')) return true;
  return false;
}

/**
 * Top 10 diversity: max 1 per exact label, max 3 per family (pass 1).
 * Pass 2: drop family cap, keep label cap.
 * Pass 3: fill remaining with one-per-match only.
 */
export function selectDiverseTips(
  sortedTips,
  limit = TOP10_LIMIT,
  maxPerLabel = 1,
  maxPerFamily = TOP10_MAX_PER_FAMILY
) {
  const selected = [];
  const usedLabels = new Map();
  const usedFamilies = new Map();
  const usedMatches = new Set();
  const maxLabel = Math.max(1, Number(maxPerLabel) || 1);
  const maxFam = Math.max(1, Number(maxPerFamily) || TOP10_MAX_PER_FAMILY);
  const items = [...(sortedTips || [])];

  const labelOf = (item) =>
    item?.tipLabel || item?.m?.suggestedBet || item?.suggestedBet || '';
  const matchIdOf = (item) => {
    const id = item?.matchId ?? item?.m?.id ?? item?.id;
    return id != null ? Number(id) : null;
  };

  const tryPick = ({ enforceFamilyCap, enforceLabelCap }) => {
    while (selected.length < limit) {
      let best = null;
      let bestIdx = Infinity;
      let bestFamMalus = Infinity;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (selected.includes(item)) continue;
        const label = labelOf(item);
        if (!label) continue;
        if (enforceLabelCap && (usedLabels.get(label) || 0) >= maxLabel) continue;
        const mid = matchIdOf(item);
        if (mid != null && usedMatches.has(mid)) continue;
        const fam = tipFamilyUi(label);
        const famCount = usedFamilies.get(fam) || 0;
        if (enforceFamilyCap && famCount >= maxFam) continue;
        if (famCount < bestFamMalus || (famCount === bestFamMalus && i < bestIdx)) {
          best = item;
          bestIdx = i;
          bestFamMalus = famCount;
        }
      }
      if (!best) break;
      const label = labelOf(best);
      const fam = tipFamilyUi(label);
      const mid = matchIdOf(best);
      selected.push(best);
      usedLabels.set(label, (usedLabels.get(label) || 0) + 1);
      usedFamilies.set(fam, (usedFamilies.get(fam) || 0) + 1);
      if (mid != null) usedMatches.add(mid);
    }
  };

  tryPick({ enforceFamilyCap: true, enforceLabelCap: true });
  if (selected.length < limit) tryPick({ enforceFamilyCap: false, enforceLabelCap: true });
  if (selected.length < limit) tryPick({ enforceFamilyCap: false, enforceLabelCap: false });
  return selected;
}

/**
 * Resolve Top 10 primary tip for a match: re-pick from allowlisted probs when
 * possible (ignores stale predictions.suggested_bet outside / below band).
 */
export function resolveTop10Primary(raw) {
  const picked = pickPlayablePrimaryFromProbs(raw);
  if (picked?.label) {
    return {
      tipLabel: picked.label,
      tipMarketProb: picked.probPct,
      confidenceScore: picked.probPct,
    };
  }
  const stored = raw?.suggestedBet || raw?.tip || raw?.suggested_bet || '';
  if (!stored || !isTipMarket(stored) || isTrivialTipLabel(stored)) {
    return null;
  }
  const prob = tipProbPct(raw);
  if (
    prob == null ||
    !Number.isFinite(Number(prob)) ||
    Number(prob) < TOP10_MIN_PROB ||
    Number(prob) > TOP10_MAX_PROB
  ) {
    return null;
  }
  return {
    tipLabel: String(stored),
    tipMarketProb: Number(prob),
    confidenceScore: raw?.confidenceScore ?? raw?.confidence_score ?? Number(prob),
  };
}

/**
 * @param {object[]} matches enriched match rows (suggestedBet, tipMarketProb, …)
 * @param {{ includeFinished?: boolean }} [opts]
 */
export function buildTop10Pool(matches, { includeFinished = false } = {}) {
  const pool = [];
  for (const raw of matches || []) {
    if (!isTop10MatchStatus(raw.status, { includeFinished })) continue;
    const resolved = resolveTop10Primary(raw);
    if (!resolved) continue;
    const matchId = raw.id ?? raw.matchId;
    const primaryView = {
      ...raw,
      id: matchId,
      suggestedBet: resolved.tipLabel,
      confidenceScore: resolved.confidenceScore,
      tipMarketProb: resolved.tipMarketProb,
    };
    const primaryMeta = tipPlayableScore(primaryView, TOP10_MIN_PROB);
    if (primaryMeta) {
      pool.push({
        m: primaryView,
        tipLabel: resolved.tipLabel,
        matchId,
        isSecondary: false,
        meta: primaryMeta,
      });
    }
  }
  return pool.sort((a, b) => {
    if (b.meta.prob !== a.meta.prob) return b.meta.prob - a.meta.prob;
    return b.meta.score - a.meta.score;
  });
}

export function pickTop10Tips(matches, limit = TOP10_LIMIT, opts = {}) {
  const pool = buildTop10Pool(matches, opts);
  return selectDiverseTips(pool, limit, 1, TOP10_MAX_PER_FAMILY);
}
