/**
 * Guards for stuck-scheduled repair: status monotonicity SQL, overdue window,
 * FD name-match repair path, aliases covered in test-live-name-match.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB = readFileSync(resolve(HERE, '../src/db.js'), 'utf8');
const SYNC = readFileSync(resolve(HERE, '../src/services/syncService.js'), 'utf8');
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

check(
  'status update never downgrades finished via CASE',
  DB.includes("WHEN status = 'finished' THEN 'finished'") &&
    DB.includes("WHEN status = 'live' AND ? = 'scheduled' THEN 'live'")
);
check(
  'updateMatchLiveByApiId uses LIVE_STATUS_SET_SQL',
  DB.includes('LIVE_STATUS_SET_SQL') && DB.includes('updateMatchLiveByApiId')
);
check(
  'overdue_scheduled looks back 72 hours (not capped at 6h only)',
  DB.includes("datetime('now', '-72 hours')") &&
    DB.includes('overdue_scheduled')
);
check('listStuckScheduledMatches exists', DB.includes('listStuckScheduledMatches'));
check(
  'live refresh name-matches FD finished onto D1',
  SYNC.includes('FD api_ids') || SYNC.includes('paint finished scores onto D1 by name')
);
check(
  'stuck_scheduled path repairs via FD finished',
  SYNC.includes('stuckRepaired') && SYNC.includes('finishedRepair')
);
check(
  'stuck_scheduled also repairs via FotMob finished when FD lags',
  SYNC.includes('fetchFotmobLiveSnapshot(-3, 0') &&
    SYNC.includes('finishedFm') &&
    SYNC.includes('paint remaining from FotMob')
);
check(
  'admin repair-stuck-scheduled endpoint',
  INDEX.includes('/api/v1/admin/matches/repair-stuck-scheduled')
);
check(
  'Slavia Praha alias in TEAM_NAME_ALIASES',
  SYNC.includes("['slavia praha', 'slavia prague']")
);
check(
  'Sparta Praha alias in TEAM_NAME_ALIASES',
  SYNC.includes("['sparta praha', 'sparta prague']")
);
check(
  'Union SG / Beer-Sheva / GNK Dinamo aliases present',
  SYNC.includes("['union sg', 'union st gilloise']") &&
    SYNC.includes("['h beer sheva', 'hapoel beer sheva']") &&
    SYNC.includes("['gnk dinamo', 'dinamo zagreb']")
);
check(
  'normalize joins initialisms / strips apostrophes',
  SYNC.includes("Be'er→Beer") && SYNC.includes('n e c')
);
check(
  'Racing / Deportivo La Liga aliases present',
  SYNC.includes("['r racing club', 'racing santander']") &&
    SYNC.includes("['rc deportivo', 'deportivo a coruna']")
);
check(
  'finished events re-fetched when scoreboard lags (not only empty json)',
  SYNC.includes('rowEventsLagScore(m)') &&
    SYNC.includes('Never regress a richer goal list')
);
check(
  'FD upsert protects FotMob-corrected kickoff',
  SYNC.includes('matches.fotmob_match_id IS NOT NULL') &&
    SYNC.includes('THEN matches.match_date')
);
check(
  'live refresh corrects scheduled kickoff drift',
  SYNC.includes('kickoffDrift') && SYNC.includes('Scheduled↔scheduled')
);

console.log(failed ? `\n${failed} checks failed` : `\n${passed}/${passed} checks passed`);
process.exit(failed ? 1 : 0);
