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
check('SHOTS rejected as trivial', isTrivialTop10Label('SHOTS_OVER_225'));
check('OVER_05 trivial', isTrivialTop10Label('OVER_05'));

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
    suggestedBet: 'HOME_WIN',
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
];

const picked = pickTop10Tips(matches, TOP10_LIMIT, { includeFinished: true });
check('includes finished in day board pool', picked.some((p) => Number(p.matchId) === 1));
check('excludes SHOTS_*', !picked.some((p) => String(p.tipLabel).startsWith('SHOTS_')));
check('fills from eligible only', picked.length === 3);

const liveOnly = pickTop10Tips(matches, TOP10_LIMIT, { includeFinished: false });
check('live Top 10 skips finished', liveOnly.length === 1 && Number(liveOnly[0].matchId) === 3);

check(
  'grades FT hit from scores',
  gradeDayTipOutcome('OVER_15', matches[0], null, {}) === 'hit'
);
check(
  'grades FT miss from scores',
  gradeDayTipOutcome('HOME_WIN', matches[1], null, {}) === 'miss'
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
    'CORNERS_OVER_95',
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
