/**
 * Aciertos «Top del día (resultado)»: same Top 10 universe as `#top3`,
 * graded with tip_results + evaluateSuggestedBet. Pending until FT; never invent.
 */

import * as store from '../db.js';
import { resolveTipOdds, modelProbForBet } from './oddsBands.js';
import { pickTop10Tips, TOP10_LIMIT, tipProbPct } from './top10Select.js';
import { computeStakeResults } from './roi.js';
import { predictMany } from './predictionService.js';
import { resolveTeamLogoUrl } from './teamLogos.js';

const CACHE_TTL_MS = 45 * 1000;
const CACHE_MAX = 24;
const dayResultsCache = new Map();

function cacheGet(key) {
  const hit = dayResultsCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    dayResultsCache.delete(key);
    return null;
  }
  return hit.payload;
}

function cacheSet(key, payload) {
  dayResultsCache.set(key, { at: Date.now(), payload });
  if (dayResultsCache.size > CACHE_MAX) {
    const oldest = [...dayResultsCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) dayResultsCache.delete(oldest[0]);
  }
}

function tipMarketProbFromPrediction(p, bet) {
  if (!p || !bet) return null;
  const raw = modelProbForBet(p, bet);
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  return Number((raw * 100).toFixed(2));
}

function missingPredictionIds(allIds, existingMap, cap = 8) {
  const missing = [];
  for (const id of allIds || []) {
    if (!existingMap.has(Number(id))) missing.push(Number(id));
    if (missing.length >= cap) break;
  }
  return missing;
}

/**
 * Grade one Top 10 tip. Prefer tip_results when market matches + settled;
 * otherwise evaluate from FT scores. Prop markets wait for extras → pending.
 * @returns {'hit'|'miss'|'pending'|'void'}
 */
export function gradeDayTipOutcome(tipLabel, match, tipRow, extras) {
  const label = String(tipLabel || '');
  if (!label) return 'pending';

  if (tipRow && String(tipRow.suggested_bet || '') === label) {
    const o = String(tipRow.outcome || 'pending').toLowerCase();
    if (o === 'hit' || o === 'miss' || o === 'void') return o;
  }

  const st = String(match?.status || '').toLowerCase();
  const hg = match?.homeGoals ?? match?.home_goals;
  const ag = match?.awayGoals ?? match?.away_goals;
  if (st !== 'finished' || hg == null || ag == null) return 'pending';

  const ex = extras || {};
  if (store.tipBetNeedsExtras(label) && !store.tipExtrasReady(label, ex)) {
    return 'pending';
  }

  const hit = store.evaluateSuggestedBet(label, hg, ag, ex);
  if (hit == null) return 'void';
  return hit ? 'hit' : 'miss';
}

/** @param {*} db @param {string} dateYmd */
export async function getDayResults(db, dateYmd) {
  const date = String(dateYmd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const err = new Error('date debe usar YYYY-MM-DD');
    err.status = 400;
    throw err;
  }

  const cached = cacheGet(date);
  if (cached) return cached;

  // Settle finished pending tips so outcomes stay fresh (cheap, batched inside).
  try {
    await store.settlePendingTips(db, 40);
  } catch (_) {
    /* keep read path available */
  }

  const matches = await store.getByDate(db, date, null);
  const allIds = matches.map((m) => m.id);
  const existing = await store.getPredictionsByMatchIds(db, allIds);
  // Predict every missing tip for this calendar day so the board can fill
  // min(qualifying, day tips) up to Top 10 — do not starve on the list GET cap of 8.
  const missing = missingPredictionIds(allIds, existing, Math.max(allIds.length, 40));
  if (missing.length) {
    try {
      await predictMany(db, missing);
    } catch (_) {
      /* proceed with whatever predictions exist */
    }
  }
  const predMap = await store.getPredictionsByMatchIds(db, allIds);
  const oddsMap = await store.getOddsByMatchIds(db, allIds);

  const enriched = matches.map((m) => {
    const p = predMap.get(m.id);
    const odds = oddsMap.get(m.id);
    const bet = p?.suggested_bet ?? null;
    const oddsMeta = resolveTipOdds(bet, p, odds);
    const conf = p?.confidence_score != null ? Number(p.confidence_score) : null;
    return {
      ...m,
      suggestedBet: bet,
      confidenceScore: conf,
      tipMarketProb: tipMarketProbFromPrediction(p, bet),
      valueEdge: p?.value_edge != null ? Number(p.value_edge) : null,
      tipOdds: oddsMeta.tipOdds,
      oddsSource: oddsMeta.oddsSource,
    };
  });

  // Same Top 10 universe as UI, but include finished (day board grades FT).
  const picked = pickTop10Tips(enriched, TOP10_LIMIT, { includeFinished: true });
  const pickIds = picked
    .map((item) => Number(item.matchId ?? item.m?.id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const [tipMap, extrasMap] = await Promise.all([
    store.getTipResultsByMatchIds(db, pickIds),
    store.getMatchExtrasByMatchIds(db, pickIds),
  ]);

  const items = picked.map((item, i) => {
    const m = item.m || {};
    const matchId = Number(item.matchId ?? m.id);
    const tipLabel = item.tipLabel || m.suggestedBet;
    const tipRow = tipMap.get(matchId) || null;
    const extras = extrasMap.get(matchId) || {};
    const outcome = gradeDayTipOutcome(tipLabel, m, tipRow, extras);
    const tipOdds =
      tipRow?.tip_odds != null && Number(tipRow.tip_odds) > 1
        ? Number(tipRow.tip_odds)
        : m.tipOdds != null
          ? Number(m.tipOdds)
          : null;
    const oddsSource =
      tipRow?.odds_source || m.oddsSource || null;
    const homeName = m.homeTeam?.name || m.home_name || '';
    const awayName = m.awayTeam?.name || m.away_name || '';
    return {
      matchId,
      rank: i + 1,
      homeName,
      awayName,
      homeLogo: resolveTeamLogoUrl(homeName, m.homeTeam?.logo || m.home_logo),
      awayLogo: resolveTeamLogoUrl(awayName, m.awayTeam?.logo || m.away_logo),
      leagueName: m.leagueName || m.league_name || null,
      leagueCountry: m.leagueCountry || m.league_country || null,
      leagueLogo: m.leagueLogo || null,
      matchDate: m.matchDate || m.match_date || null,
      status: m.status || null,
      homeGoals: m.homeGoals ?? m.home_goals ?? null,
      awayGoals: m.awayGoals ?? m.away_goals ?? null,
      suggestedBet: tipLabel,
      tipMarketProb: tipProbPct(m),
      tipOdds: tipOdds != null && Number.isFinite(tipOdds) && tipOdds > 1 ? tipOdds : null,
      oddsSource,
      outcome,
    };
  });

  let hits = 0;
  let misses = 0;
  let pending = 0;
  let voids = 0;
  const stakeRows = [];
  for (const it of items) {
    const o = it.outcome;
    if (o === 'hit') hits += 1;
    else if (o === 'miss') misses += 1;
    else if (o === 'void') voids += 1;
    else pending += 1;
    if (o === 'hit' || o === 'miss' || o === 'void') {
      stakeRows.push({
        outcome: o,
        odds: it.tipOdds,
        source: it.oddsSource,
      });
    }
  }
  const resolved = hits + misses;
  const total = items.length;
  const roi = computeStakeResults(stakeRows);

  const payload = {
    date,
    summary: {
      resolved,
      total,
      hits,
      misses,
      pending,
      voids,
      hitRate: resolved ? Number((hits / resolved).toFixed(4)) : null,
      yield: roi.yield,
      staked: roi.staked,
      profit: roi.profit,
    },
    items,
  };
  cacheSet(date, payload);
  return payload;
}
