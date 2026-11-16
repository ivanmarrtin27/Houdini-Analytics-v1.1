/**
 * Normalize match incidents (goals / red cards / missed pens) from AF or FotMob.
 */

import { FOTMOB_MATCH_API_BASE, FOTMOB_LEAGUE_API_BASE } from './fotmobInternationals.js';
import { FOTMOB_DOMESTIC_MATCH_BASE } from './fotmobDomestic.js';

export function fotmobMatchIdFromApiId(apiId) {
  const n = Number(apiId);
  if (!Number.isFinite(n)) return null;
  if (n >= FOTMOB_DOMESTIC_MATCH_BASE && n < FOTMOB_DOMESTIC_MATCH_BASE + 50_000_000) {
    return n - FOTMOB_DOMESTIC_MATCH_BASE;
  }
  if (n >= FOTMOB_MATCH_API_BASE && n < FOTMOB_LEAGUE_API_BASE) {
    return n - FOTMOB_MATCH_API_BASE;
  }
  return null;
}

function pushEvent(out, ev) {
  if (!ev || !ev.type || ev.minute == null) return;
  if (ev.type === 'goal' && ev.isHome !== true && ev.isHome !== false) return;
  out.push({
    type: ev.type,
    minute: Number(ev.minute),
    player: ev.player || null,
    isHome: ev.isHome === true,
    detail: ev.detail || null,
  });
}

/** Goal tallies from stored incidents (own goals count for the side credited in `isHome`). */
export function countGoalEventsBySide(events) {
  let home = 0;
  let away = 0;
  for (const e of events || []) {
    if (!e || e.type !== 'goal') continue;
    if (e.isHome === true) home += 1;
    else if (e.isHome === false) away += 1;
  }
  return { home, away };
}

/** True when the scoreboard has more goals than we have goal events for either side. */
export function matchEventsLagScore(match) {
  if (!match || (match.status !== 'live' && match.status !== 'finished')) return false;
  const hg = Number(match.homeGoals);
  const ag = Number(match.awayGoals);
  if (!Number.isFinite(hg) || !Number.isFinite(ag)) return false;
  const { home, away } = countGoalEventsBySide(match.events);
  return home < hg || away < ag;
}

function namesMatch(a, b) {
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** API-Football fixtures/events response → compact list. */
export function normalizeAfEvents(response, homeTeamId, awayTeamId, homeName = '', awayName = '') {
  const rows = response?.response || response || [];
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows) {
    const type = String(row.type || '');
    const detail = String(row.detail || '');
    const minute = row.time?.elapsed != null ? Number(row.time.elapsed) : null;
    const player = row.player?.name || null;
    const teamId = row.team?.id != null ? Number(row.team.id) : null;
    const teamName = row.team?.name || '';
    let isHome = null;
    if (homeTeamId != null && teamId === Number(homeTeamId)) isHome = true;
    else if (awayTeamId != null && teamId === Number(awayTeamId)) isHome = false;
    else if (namesMatch(teamName, homeName)) isHome = true;
    else if (namesMatch(teamName, awayName)) isHome = false;
    if (isHome == null) continue;

    if (type === 'Goal') {
      if (/Missed Penalty/i.test(detail)) {
        pushEvent(out, { type: 'missed_pen', minute, player, isHome, detail });
      } else if (/Own Goal/i.test(detail)) {
        pushEvent(out, { type: 'goal', minute, player, isHome, detail: 'own' });
      } else {
        pushEvent(out, {
          type: 'goal',
          minute,
          player,
          isHome,
          detail: /Penalty/i.test(detail) ? 'pen' : null,
        });
      }
    } else if (type === 'Card' && /Red|Second Yellow/i.test(detail)) {
      pushEvent(out, { type: 'red', minute, player, isHome, detail });
    }
  }
  return out.sort((a, b) => a.minute - b.minute || String(a.type).localeCompare(b.type));
}

/** Flatten FotMob goal/card maps: { "Surname": [ event, ... ] } or []. */
function flattenFotmobSide(bucket) {
  if (!bucket) return [];
  if (Array.isArray(bucket)) return bucket;
  if (typeof bucket === 'object') {
    return Object.values(bucket).flatMap((v) => (Array.isArray(v) ? v : [v]));
  }
  return [];
}

function fotmobGoalEvent(g, isHome) {
  const minute = Number(g.time ?? g.minute ?? g.timeStr ?? g.clock?.minute);
  const player =
    g.fullName || g.nameStr || g.name || g.playerName || g.player?.name || null;
  const gt = String(g.goalDescription || g.goalDescriptionKey || g.type || '');
  const own = g.ownGoal === true || /Own|own/i.test(gt);
  const pen = /Pen|pen/i.test(gt) || g.isPenalty === true;
  if (/Missed|missed/i.test(gt) || g.type === 'MissedPenalty') {
    return { type: 'missed_pen', minute, player, isHome };
  }
  return {
    type: 'goal',
    minute,
    player,
    isHome,
    detail: own ? 'own' : pen ? 'pen' : null,
  };
}

/** FotMob matchDetails header.events → compact list. */
export function normalizeFotmobEvents(details) {
  const events = details?.header?.events;
  if (!events) return [];
  const out = [];
  for (const g of flattenFotmobSide(events.homeTeamGoals || events.homeGoals)) {
    pushEvent(out, fotmobGoalEvent(g, true));
  }
  for (const g of flattenFotmobSide(events.awayTeamGoals || events.awayGoals)) {
    pushEvent(out, fotmobGoalEvent(g, false));
  }
  for (const c of flattenFotmobSide(events.homeTeamRedCards)) {
    const minute = Number(c.time ?? c.minute ?? c.timeStr);
    const player = c.fullName || c.nameStr || c.name || c.player?.name || null;
    pushEvent(out, { type: 'red', minute, player, isHome: true });
  }
  for (const c of flattenFotmobSide(events.awayTeamRedCards)) {
    const minute = Number(c.time ?? c.minute ?? c.timeStr);
    const player = c.fullName || c.nameStr || c.name || c.player?.name || null;
    pushEvent(out, { type: 'red', minute, player, isHome: false });
  }
  for (const c of flattenFotmobSide(events.cardEvents || events.cards)) {
    const card = String(c.card || c.type || '');
    if (!/Red|Second Yellow/i.test(card)) continue;
    const minute = Number(c.time ?? c.minute);
    const player = c.fullName || c.name || c.playerName || null;
    const isHome = c.isHome != null ? Boolean(c.isHome) : c.team === 1;
    pushEvent(out, { type: 'red', minute, player, isHome });
  }
  return out.sort((a, b) => a.minute - b.minute || String(a.type).localeCompare(b.type));
}

function fotmobStatRows(details) {
  const groups = details?.content?.stats?.Periods?.All?.stats || [];
  return groups.flatMap((group) => (Array.isArray(group?.stats) ? group.stats : []));
}

function fotmobStatPair(details, keys) {
  const wanted = new Set((keys || []).map((key) => String(key).toLowerCase()));
  const row = fotmobStatRows(details).find((item) => {
    const key = String(item?.key || '').toLowerCase();
    const title = String(item?.title || '').toLowerCase();
    return wanted.has(key) || wanted.has(title);
  });
  const values = row?.rawStats || row?.stats;
  if (!Array.isArray(values) || values.length < 2) return [null, null];
  return values.slice(0, 2).map((value) => {
    if (value && typeof value === 'object' && 'value' in value) value = value.value;
    if (value == null || value === '') return null;
    const match = String(value).match(/-?\d+(?:\.\d+)?/);
    const n = match ? Number(match[0]) : NaN;
    return Number.isFinite(n) ? n : null;
  });
}

/** FotMob matchDetails → home/away totals used by the extra-market models. */
export function normalizeFotmobStats(details) {
  const [homeCorners, awayCorners] = fotmobStatPair(details, ['corners', 'corner kicks']);
  const [homeYellows, awayYellows] = fotmobStatPair(details, [
    'yellow_cards',
    'yellow cards',
  ]);
  const [homeShots, awayShots] = fotmobStatPair(details, ['total_shots', 'total shots']);
  const [homeSot, awaySot] = fotmobStatPair(details, [
    'shotsontarget',
    'shots on target',
  ]);
  return {
    home: {
      corners: homeCorners,
      yellows: homeYellows,
      shots: homeShots,
      shotsOnTarget: homeSot,
    },
    away: {
      corners: awayCorners,
      yellows: awayYellows,
      shots: awayShots,
      shotsOnTarget: awaySot,
    },
  };
}

/** Short isolate cache — panel + sync often hit the same matchDetails. */
const fotmobDetailsCache = new Map();
const FOTMOB_DETAILS_TTL_MS = 5 * 60 * 1000;
const FOTMOB_DETAILS_CACHE_MAX = 80;

export async function fetchFotmobMatchDetails(fotmobId) {
  const id = Number(fotmobId);
  if (!Number.isFinite(id) || id <= 0) throw new Error('FotMob matchId inválido');
  const hit = fotmobDetailsCache.get(id);
  if (hit && Date.now() - hit.at < FOTMOB_DETAILS_TTL_MS) return hit.data;

  const url = `https://www.fotmob.com/api/data/matchDetails?matchId=${id}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'HoudiniBet/1.0',
    },
  });
  if (!res.ok) throw new Error(`FotMob matchDetails ${res.status}`);
  const data = await res.json();
  fotmobDetailsCache.set(id, { at: Date.now(), data });
  if (fotmobDetailsCache.size > FOTMOB_DETAILS_CACHE_MAX) {
    const oldest = fotmobDetailsCache.keys().next().value;
    fotmobDetailsCache.delete(oldest);
  }
  return data;
}

/** Best-effort XI for a match row (uses fotmobMatchId). */
export async function fetchLineupsForMatch(match) {
  const fotmobId = Number(match?.fotmobMatchId);
  if (!Number.isFinite(fotmobId) || fotmobId <= 0) return null;
  try {
    const details = await fetchFotmobMatchDetails(fotmobId);
    return parseFotmobLineups(details);
  } catch (_) {
    return null;
  }
}

function lineupPlayerName(p) {
  if (!p || typeof p !== 'object') return null;
  return (
    p.name ||
    p.fullName ||
    p.nameStr ||
    p.playerName ||
    p.player?.name ||
    null
  );
}

function lineupShirt(p) {
  if (!p || typeof p !== 'object') return null;
  const n = p.shirtNumber ?? p.shirt ?? p.number ?? p.jerseyNumber ?? null;
  const num = Number(n);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/** Normalize 0–1 pitch coords; prefer verticalLayout (own goal ≈ top). */
function lineupCoords(p) {
  if (!p || typeof p !== 'object') return { x: null, y: null };
  const asPair = (layout, swap = false) => {
    if (!layout || typeof layout !== 'object') return null;
    const rawX = Number(layout.x);
    const rawY = Number(layout.y);
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return null;
    const x = swap ? rawY : rawX;
    const y = swap ? rawX : rawY;
    if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) return null;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  };
  return (
    asPair(p.verticalLayout) ||
    asPair(p.horizontalLayout, true) ||
    asPair(p.layout) ||
    { x: null, y: null }
  );
}

function parseLineupSide(side) {
  if (!side || typeof side !== 'object') return null;
  const startersRaw =
    side.starters ||
    side.startXI ||
    side.players ||
    side.lineup ||
    side.members ||
    [];
  const list = Array.isArray(startersRaw) ? startersRaw : [];
  const starters = list
    .map((p) => {
      const name = lineupPlayerName(p);
      if (!name) return null;
      const { x, y } = lineupCoords(p);
      return { name: String(name), shirt: lineupShirt(p), x, y };
    })
    .filter(Boolean)
    .slice(0, 11);
  if (!starters.length) return null;
  const formation =
    side.formation || side.formationLabel || side.layout || side.formationString || null;
  return {
    formation: formation ? String(formation) : null,
    starters,
  };
}

function pickColor(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Allow #hex and rgba()/rgb() from FotMob font* fields.
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
  if (/^rgba?\(/i.test(s)) return s;
  return null;
}

/**
 * Kit hex from matchDetails.general.teamColors (prefer darkMode for our UI).
 * @returns {{ home: string|null, away: string|null, fontHome: string|null, fontAway: string|null }|null}
 */
function parseFotmobKitColors(details) {
  if (!details || typeof details !== 'object') return null;
  const general = details.general || details.content?.matchFacts?.general || {};
  const tc =
    general.teamColors ||
    details.teamColors ||
    details.content?.stats?.Periods?.All?.teamColors ||
    null;
  if (!tc || typeof tc !== 'object') return null;

  const dark = tc.darkMode && typeof tc.darkMode === 'object' ? tc.darkMode : null;
  const light = tc.lightMode && typeof tc.lightMode === 'object' ? tc.lightMode : null;
  const fontDark =
    tc.fontDarkMode && typeof tc.fontDarkMode === 'object' ? tc.fontDarkMode : null;
  const fontLight =
    tc.fontLightMode && typeof tc.fontLightMode === 'object' ? tc.fontLightMode : null;

  // Legacy flat shape: { home, away }
  const home = pickColor(dark?.home ?? light?.home ?? tc.home);
  const away = pickColor(dark?.away ?? light?.away ?? tc.away);
  const fontHome = pickColor(fontDark?.home ?? fontLight?.home ?? tc.fontHome);
  const fontAway = pickColor(fontDark?.away ?? fontLight?.away ?? tc.fontAway);
  if (!home && !away && !fontHome && !fontAway) return null;
  return { home, away, fontHome, fontAway };
}

/**
 * Best-effort XI from FotMob matchDetails (shapes vary by season/UI).
 * Additive fields: starter x/y, top-level kit colors. Existing name/shirt/formation kept.
 * @returns {{ home: object|null, away: object|null, kit: object|null }|null}
 */
export function parseFotmobLineups(details) {
  if (!details || typeof details !== 'object') return null;
  const content = details.content || details;
  const lineup =
    content.lineup ||
    content.lineups ||
    details.lineup ||
    details.lineups ||
    content?.lineup?.lineup ||
    null;
  if (!lineup || typeof lineup !== 'object') return null;

  const homeSide =
    lineup.homeTeam ||
    lineup.home ||
    lineup.teams?.[0] ||
    (Array.isArray(lineup) ? lineup[0] : null);
  const awaySide =
    lineup.awayTeam ||
    lineup.away ||
    lineup.teams?.[1] ||
    (Array.isArray(lineup) ? lineup[1] : null);

  const home = parseLineupSide(homeSide);
  const away = parseLineupSide(awaySide);
  if (!home && !away) return null;
  const kit = parseFotmobKitColors(details);
  return { home, away, kit: kit || null };
}

export function parseEventsJson(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
