/**
 * Top 10 tip selection (same rules as public `#top3` client).
 * P 78–95% desc, cuota max 3.50, primary only, anti-trivial, family diversity.
 * Never SHOTS_*. Day-results may include finished matches; live Top 10 skips them.
 */

export const TOP10_MIN_PROB = 78;
export const TOP10_MAX_PROB = 95;
export const TOP10_MAX_ODDS = 3.5;
export const TOP10_MAX_PER_FAMILY = 3;
export const TOP10_LIMIT = 10;
export const TOP10_TRIVIAL_LABELS = new Set(['OVER_05', 'UNDER_45']);

export function isTrivialTop10Label(label) {
  const lab = String(label || '').toUpperCase();
  return TOP10_TRIVIAL_LABELS.has(lab) || lab.startsWith('SHOTS_');
}

export function tipFamilyUi(code) {
  const b = String(code || '').toUpperCase();
  if (b === 'HOME_WIN' || b === 'DRAW' || b === 'AWAY_WIN') return '1x2';
  if (b.startsWith('DC_') || b.startsWith('DNB_')) return 'dc';
  if (b === 'BTTS_YES' || b === 'BTTS_NO') return 'btts';
  if (
    b.startsWith('OVER_') ||
    b.startsWith('UNDER_') ||
    b.startsWith('HOME_OVER') ||
    b.startsWith('HOME_UNDER') ||
    b.startsWith('AWAY_OVER') ||
    b.startsWith('AWAY_UNDER')
  ) {
    return 'ou';
  }
  if (b.startsWith('CORNERS_')) return 'corners';
  if (b.startsWith('CARDS_')) return 'cards';
  if (b.startsWith('SHOTS_')) return 'shots';
  if (b.startsWith('SOT_')) return 'shots_on_target';
  return 'other';
}

/** Truncate display % the same way as client formatTipPct. */
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

export function tipOddsForTop10Band(m, probPct) {
  const raw = m?.tipOdds != null ? Number(m.tipOdds) : null;
  const p = Number(probPct) / 100;
  const implied =
    Number.isFinite(p) && p > 0.01 && p < 0.99 ? 1 / p : null;
  // Prefer in-band book/model cuota; if raw is a longshot, fall back to 1/p so
  // high-P tips still fill quiet days (P band is the product gate, not cuota alone).
  if (raw != null && Number.isFinite(raw) && raw > 1 && raw <= TOP10_MAX_ODDS) {
    return raw;
  }
  if (implied != null && implied <= TOP10_MAX_ODDS) return implied;
  if (raw != null && Number.isFinite(raw) && raw > 1) return raw;
  return null;
}

export function tipPlayableScore(m, minProb = TOP10_MIN_PROB) {
  const tip = m?.suggestedBet || m?.tip || m?.suggested_bet || '';
  if (!tip || isTrivialTop10Label(tip)) return null;
  const prob = tipProbPct(m);
  if (
    prob == null ||
    !Number.isFinite(Number(prob)) ||
    Number(prob) < minProb ||
    Number(prob) > TOP10_MAX_PROB
  ) {
    return null;
  }
  const odds = tipOddsForTop10Band(m, prob);
  if (odds == null || !Number.isFinite(odds) || odds <= 1 || odds > TOP10_MAX_ODDS) {
    return null;
  }
  const isBook = m.oddsSource === 'book' && m.tipOdds != null && Number(m.tipOdds) > 1;
  let score = (Number(prob) / 100) * Math.log(Math.max(odds, 1.01));
  const edge = m.valueEdge != null ? Number(m.valueEdge) : null;
  if (edge != null && Number.isFinite(edge)) score += Math.max(0, edge) * 0.15;
  if (!isBook) score -= 0.05;
  return {
    score,
    kind: isBook ? 'book' : 'est',
    prob: Number(prob),
  };
}

export function isTop10MatchStatus(status, { includeFinished = false } = {}) {
  const s = String(status || '').toLowerCase();
  if (s === 'scheduled' || s === 'live' || s === '') return true;
  if (includeFinished && s === 'finished') return true;
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
 * @param {object[]} matches enriched match rows (suggestedBet, tipMarketProb, tipOdds, …)
 * @param {{ includeFinished?: boolean }} [opts]
 */
export function buildTop10Pool(matches, { includeFinished = false } = {}) {
  const pool = [];
  for (const raw of matches || []) {
    if (!raw?.suggestedBet || isTrivialTop10Label(raw.suggestedBet)) continue;
    if (!isTop10MatchStatus(raw.status, { includeFinished })) continue;
    const matchId = raw.id ?? raw.matchId;
    const primaryView = {
      ...raw,
      id: matchId,
      suggestedBet: raw.suggestedBet,
      tipOdds: raw.tipOdds,
      oddsSource: raw.oddsSource,
      confidenceScore: raw.confidenceScore,
      tipMarketProb: raw.tipMarketProb,
      valueEdge: raw.valueEdge,
    };
    const primaryMeta = tipPlayableScore(primaryView, TOP10_MIN_PROB);
    if (primaryMeta) {
      pool.push({
        m: primaryView,
        tipLabel: raw.suggestedBet,
        matchId,
        isSecondary: false,
        meta: primaryMeta,
      });
    }
  }
  return pool.sort((a, b) => {
    if (b.meta.prob !== a.meta.prob) return b.meta.prob - a.meta.prob;
    if (a.meta.kind === 'book' && b.meta.kind !== 'book') return -1;
    if (b.meta.kind === 'book' && a.meta.kind !== 'book') return 1;
    return b.meta.score - a.meta.score;
  });
}

export function pickTop10Tips(matches, limit = TOP10_LIMIT, opts = {}) {
  const pool = buildTop10Pool(matches, opts);
  return selectDiverseTips(pool, limit, 1, TOP10_MAX_PER_FAMILY);
}
