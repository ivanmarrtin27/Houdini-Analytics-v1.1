/** Smoke: Top 10 day-results selection + grading (no invented FT results). */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pickTop10Tips,
  isTrivialTop10Label,
  TOP10_LIMIT,
  tipPlayableScore,
} from '../src/services/top10Select.js';
import { gradeDayTipOutcome } from '../src/services/dayResultsService.js';
import { isTipMarket } from '../src/services/tipMarkets.js';
import { mapFotmobStatus } from '../src/services/fotmobInternationals.js';
import { isTop10MatchStatus } from '../src/services/top10Select.js';
import { enrichMatchesMissingExtras } from '../src/services/syncService.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = readFileSync(resolve(HERE, '../src/index.js'), 'utf8');
const APP = readFileSync(resolve(HERE, '../public/app.js'), 'utf8');
const PAGES_APP = readFileSync(resolve(HERE, '../pages/app.js'), 'utf8');

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

check('route day-results registered', INDEX.includes("/api/v1/tips/day-results"));
check('UI renderAciertos present', APP.includes('async function renderAciertos'));
check('pages synced with renderAciertos', PAGES_APP.includes('async function renderAciertos'));
check('no Próximamente placeholder in public shell', !APP.includes("aciertos.soonTitle"));
check('Aciertos rows omit tipOdds display', !/function aciertosRowHtml[\s\S]*?tipOddsDisplay\(item\.tipOdds\)/.test(APP));
check('Aciertos summary omits yield', !APP.includes("t('aciertos.yield')") && !APP.includes('formatAciertosYield'));
check('tab enter helper present', APP.includes('function triggerViewEnter'));
check('SHOTS rejected as trivial', isTrivialTop10Label('SHOTS_OVER_225'));
check('OVER_05 trivial', isTrivialTop10Label('OVER_05'));
check('HOME_WIN not tip market', !isTipMarket('HOME_WIN'));
check('BTTS_YES is tip market', isTipMarket('BTTS_YES'));
check('CORNERS_OVER_75 is tip market', isTipMarket('CORNERS_OVER_75'));

const matches = [
  {
    id: 1,
    status: 'finished',
    suggestedBet: 'OVER_15',
    tipMarketProb: 88,
    tipOdds: 1.4,
    oddsSource: 'book',
    homeGoals: 2,
    awayGoals: 1,
    homeTeam: { name: 'A' },
    awayTeam: { name: 'B' },
  },
  {
    id: 2,
    status: 'finished',
    suggestedBet: 'DC_1X',
    tipMarketProb: 82,
    tipOdds: 1.55,
    oddsSource: 'book',
    homeGoals: 0,
    awayGoals: 1,
    homeTeam: { name: 'C' },
    awayTeam: { name: 'D' },
  },
  {
    id: 3,
    status: 'scheduled',
    suggestedBet: 'BTTS_YES',
    tipMarketProb: 80,
    tipOdds: 1.7,
    oddsSource: 'book',
    homeTeam: { name: 'E' },
    awayTeam: { name: 'F' },
  },
  {
    id: 4,
    status: 'finished',
    suggestedBet: 'SHOTS_OVER_225',
    tipMarketProb: 90,
    tipOdds: 1.5,
    oddsSource: 'book',
  },
  {
    id: 5,
    status: 'finished',
    suggestedBet: 'HOME_WIN',
    tipMarketProb: 91,
    tipOdds: 1.4,
    oddsSource: 'book',
    homeGoals: 2,
    awayGoals: 0,
  },
];

const picked = pickTop10Tips(matches, TOP10_LIMIT, { includeFinished: true });
check('includes finished in day board pool', picked.some((p) => Number(p.matchId) === 1));
check('excludes SHOTS_*', !picked.some((p) => String(p.tipLabel).startsWith('SHOTS_')));
check('excludes non-allowlisted HOME_WIN', !picked.some((p) => p.tipLabel === 'HOME_WIN'));
check('fills from eligible only', picked.length === 3);

/** Quiet day: 6 qualifying tips → show all 6 (cap still 10). */
const sixDay = Array.from({ length: 6 }, (_, i) => ({
  id: 200 + i,
  status: i % 2 === 0 ? 'finished' : 'scheduled',
  suggestedBet: i % 2 === 0 ? 'OVER_15' : 'DC_1X',
  tipMarketProb: 90 - i,
  tipOdds: 1.35 + i * 0.05,
  oddsSource: 'model',
  homeGoals: 2,
  awayGoals: 1,
  homeTeam: { name: `H${i}` },
  awayTeam: { name: `A${i}` },
}));
const sixPicked = pickTop10Tips(sixDay, TOP10_LIMIT, { includeFinished: true });
check(
  'day board fills all 6 qualifying tips (no under-show)',
  sixPicked.length === 6 && new Set(sixPicked.map((p) => p.matchId)).size === 6
);
check(
  'long book cuota ignored; P in band still fills',
  tipPlayableScore({
    suggestedBet: 'DC_X2',
    tipMarketProb: 82,
    tipOdds: 4.2,
    oddsSource: 'book',
  }) != null
);

const liveOnly = pickTop10Tips(matches, TOP10_LIMIT, { includeFinished: false });
check('live Top 10 skips finished', liveOnly.length === 1 && Number(liveOnly[0].matchId) === 3);

check(
  'grades FT hit from scores',
  gradeDayTipOutcome('OVER_15', matches[0], null, {}) === 'hit'
);
check(
  'grades FT miss from scores',
  gradeDayTipOutcome('DC_1X', matches[1], null, {}) === 'miss'
);
check(
  'pending until FT',
  gradeDayTipOutcome('BTTS_YES', matches[2], null, {}) === 'pending'
);
check(
  'uses tip_results when market matches',
  gradeDayTipOutcome('OVER_15', matches[0], { suggested_bet: 'OVER_15', outcome: 'miss' }, {}) ===
    'miss'
);
check(
  'prop without extras stays pending (no invent)',
  gradeDayTipOutcome(
    'CORNERS_OVER_75',
    { status: 'finished', homeGoals: 1, awayGoals: 1 },
    null,
    {}
  ) === 'pending'
);
check(
  'high-P tip scores into band',
  tipPlayableScore({
    suggestedBet: 'OVER_15',
    tipMarketProb: 88,
    tipOdds: 1.4,
    oddsSource: 'book',
  }) != null
);
check(
  'grades CORNERS_OVER_75 with extras',
  gradeDayTipOutcome(
    'CORNERS_OVER_75',
    { status: 'finished', homeGoals: 1, awayGoals: 1 },
    null,
    { cornersTotal: 9 }
  ) === 'hit'
);
check(
  'grades CORNERS_OVER_75 miss when under line',
  gradeDayTipOutcome(
    'CORNERS_OVER_75',
    { status: 'finished', homeGoals: 3, awayGoals: 1 },
    null,
    { cornersTotal: 4 }
  ) === 'miss'
);
check(
  'grades SOT_OVER_75 hit with extras',
  gradeDayTipOutcome(
    'SOT_OVER_75',
    { status: 'finished', homeGoals: 3, awayGoals: 1 },
    null,
    { shotsOnTargetTotal: 15 }
  ) === 'hit'
);
check(
  'grades SOT_OVER_75 miss when under line',
  gradeDayTipOutcome(
    'SOT_OVER_75',
    { status: 'finished', homeGoals: 1, awayGoals: 0 },
    null,
    { shotsOnTargetTotal: 6 }
  ) === 'miss'
);
check(
  'on-read enrich helper exported from sync',
  typeof enrichMatchesMissingExtras === 'function'
);
check(
  'dayResults preserves match id over prediction id',
  /id:\s*m\.id/.test(readFileSync(resolve(HERE, '../src/services/dayResultsService.js'), 'utf8'))
);
check(
  'postponed tip grades void (no invent)',
  gradeDayTipOutcome(
    'OVER_15',
    { status: 'postponed', homeGoals: null, awayGoals: null },
    null,
    {}
  ) === 'void'
);
check(
  'cancelled tip grades void',
  gradeDayTipOutcome('BTTS_YES', { status: 'cancelled' }, null, {}) === 'void'
);
check(
  'FotMob PP → postponed',
  mapFotmobStatus({
    cancelled: true,
    finished: false,
    started: false,
    reason: { short: 'PP', longKey: 'postponed' },
  }) === 'postponed'
);
check(
  'FotMob cancelled → cancelled',
  mapFotmobStatus({
    cancelled: true,
    finished: false,
    started: false,
    reason: { short: 'CANC', longKey: 'cancelled' },
  }) === 'cancelled'
);
check(
  'day board includes postponed',
  isTop10MatchStatus('postponed', { includeFinished: true }) === true
);
check(
  'live Top 10 skips postponed',
  isTop10MatchStatus('postponed', { includeFinished: false }) === false
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
