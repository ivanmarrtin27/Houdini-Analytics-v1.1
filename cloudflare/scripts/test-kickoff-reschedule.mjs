/**
 * Kickoff reschedule: FotMob scheduled+utcTime in includeAll, live paint of
 * match_date, FD upsert must not revert FotMob-corrected times.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapAnyLiveMatch } from '../src/services/fotmobInternationals.js';
import { findBestFixtureMatch, teamNameScore } from '../src/services/syncService.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB = readFileSync(resolve(HERE, '../src/db.js'), 'utf8');
const SYNC = readFileSync(resolve(HERE, '../src/services/syncService.js'), 'utf8');
const FM = readFileSync(resolve(HERE, '../src/services/fotmobInternationals.js'), 'utf8');

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

// --- mapAnyLiveMatch includes scheduled + utcTime (Auxerre-like) ---
const auxerreFm = mapAnyLiveMatch({
  id: 5802983,
  home: { name: 'Auxerre' },
  away: { name: 'Paris FC' },
  status: {
    utcTime: '2026-11-07T18:00:00.000Z',
    started: false,
    finished: false,
    cancelled: false,
  },
});
check('scheduled Auxerre maps (not null)', auxerreFm != null);
check('scheduled Auxerre status is scheduled', auxerreFm?.status === 'scheduled');
check(
  'scheduled Auxerre matchDate is 18:00 UTC',
  auxerreFm?.matchDate === '2026-11-07 18:00:00'
);
check('scheduled Auxerre has fotmobId', auxerreFm?.fotmobId === 5802983);
check('scheduled Auxerre has null scores', auxerreFm?.homeGoals == null && auxerreFm?.awayGoals == null);

const psgFm = mapAnyLiveMatch({
  id: 5802987,
  home: { name: 'Paris Saint-Germain' },
  away: { name: 'Troyes' },
  status: {
    utcTime: '2026-11-07T20:05:00.000Z',
    started: false,
    finished: false,
    cancelled: false,
  },
});
check(
  'PSG–Troyes scheduled matchDate is 20:05 UTC',
  psgFm?.matchDate === '2026-11-07 20:05:00'
);

check(
  'AJ Auxerre vs Auxerre name-match ≥85',
  teamNameScore('AJ Auxerre', 'Auxerre') >= 85
);
check(
  'Estac Troyes vs Troyes name-match ≥85',
  teamNameScore('Estac Troyes', 'Troyes') >= 85
);

const ligue1Fm = [
  { _fm: auxerreFm, teams: { home: { name: 'Auxerre' }, away: { name: 'Paris FC' } } },
  { _fm: psgFm, teams: { home: { name: 'Paris Saint-Germain' }, away: { name: 'Troyes' } } },
];
check(
  'D1 Auxerre–Paris FC name-matches FotMob scheduled',
  findBestFixtureMatch(ligue1Fm, 'AJ Auxerre', 'Paris FC')?._fm?.fotmobId === 5802983
);
check(
  'D1 PSG–Estac Troyes name-matches FotMob scheduled',
  findBestFixtureMatch(ligue1Fm, 'Paris Saint-Germain', 'Estac Troyes')?._fm?.fotmobId ===
    5802987
);

// Live/finished still map
const liveFm = mapAnyLiveMatch({
  id: 1,
  home: { name: 'A', score: 1 },
  away: { name: 'B', score: 0 },
  status: {
    utcTime: '2026-11-07T15:00:00.000Z',
    started: true,
    finished: false,
    cancelled: false,
    liveTime: { short: "33'" },
  },
});
check('live match still maps', liveFm?.status === 'live' && liveFm?.homeGoals === 1);

// --- source guards ---
check(
  'mapAnyLiveMatch allows scheduled status',
  FM.includes("status !== 'scheduled'") && FM.includes('matchDate')
);
check(
  'includeAll comment mentions scheduled kickoff corrections',
  FM.includes('scheduled/live/finished') || FM.includes('kickoff corrections')
);
check(
  'live refresh paints match_date on kickoff drift',
  SYNC.includes('kickoffDrift') &&
    SYNC.includes('const datePatch = fmDate || null') &&
    SYNC.includes('match_date: datePatch')
);
check(
  'FD upsert keeps FotMob-corrected match_date',
  SYNC.includes('matches.fotmob_match_id IS NOT NULL') &&
    SYNC.includes('datetime(matches.match_date) != datetime(excluded.match_date)') &&
    SYNC.includes('THEN matches.match_date')
);
check(
  'updateMatchLiveBatch writes optional match_date via COALESCE',
  DB.includes('match_date = COALESCE(?, match_date)')
);
check(
  'updateMatchKickoffBatch exists for date-only repairs',
  DB.includes('updateMatchKickoffBatch') && SYNC.includes('updateMatchKickoffBatch')
);

console.log(failed ? `\n${failed} checks failed` : `\n${passed}/${passed} checks passed`);
process.exit(failed ? 1 : 0);
