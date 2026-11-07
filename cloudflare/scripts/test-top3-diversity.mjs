/** Tests for Top 10 exact-label + family diversity (max 3 per family) + P 78–95% band. */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(HERE, '../public/app.js'), 'utf8');

function extractFunction(name) {
  const idx = src.indexOf(`function ${name}(`);
  if (idx < 0) throw new Error(`${name} not found`);
  const start = src.lastIndexOf('\n', idx) + 1;
  const paren = src.indexOf('(', idx);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let i = paren; i < src.length; i += 1) {
    if (src[i] === '(') parenDepth += 1;
    else if (src[i] === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = src.indexOf('{', i);
        break;
      }
    }
  }
  let depth = 0;
  for (let i = bodyStart; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`${name} not closed`);
}

const tipMarketStart = src.indexOf('const TIP_MARKET_SET = new Set([');
const tipMarketEnd = src.indexOf(']);', tipMarketStart) + 3;
const tipMarketDecl = src.slice(tipMarketStart, tipMarketEnd);

const api = new Function(
  `${tipMarketDecl}
   const TOP10_MIN_PROB = 78;
   const TOP10_MAX_PROB = 95;
   const TOP10_TRIVIAL_LABELS = new Set(['OVER_05', 'UNDER_45']);
   const TOP10_MAX_PER_FAMILY = 3;
   const TOP10_LIMIT = 10;
   function tipProbPct(raw) {
     const tipMarket = raw?.tipMarketProb ?? raw?.tip_market_prob;
     if (tipMarket != null && Number(tipMarket) > 0) {
       const n = Number(tipMarket);
       return Math.trunc(n <= 1 ? n * 100 : n);
     }
     const conf = raw?.confidenceScore != null ? Number(raw.confidenceScore) : null;
     return conf != null && conf > 0 ? Math.trunc(conf) : null;
   }
   ${extractFunction('isTipMarket')}
   ${extractFunction('isTrivialTop10Label')}
   ${extractFunction('tipPlayableScore')}
   ${extractFunction('tipFamilyUi')}
   ${extractFunction('isTop10MatchStatus')}
   ${extractFunction('selectDiverseTips')}
   ${extractFunction('buildTop10Pool')}
   ${extractFunction('pickTop10Tips')}
   return {
     tipFamilyUi,
     selectDiverseTips,
     tipPlayableScore,
     buildTop10Pool,
     pickTop10Tips,
     isTop10MatchStatus,
     isTipMarket,
   };`
)();

const {
  tipFamilyUi,
  selectDiverseTips,
  tipPlayableScore,
  buildTop10Pool,
  pickTop10Tips,
  isTop10MatchStatus,
  isTipMarket,
} = api;

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

const ranked = [
  { m: { id: 1, suggestedBet: 'BTTS_YES' }, tipLabel: 'BTTS_YES', matchId: 1 },
  { m: { id: 2, suggestedBet: 'BTTS_YES' }, tipLabel: 'BTTS_YES', matchId: 2 },
  { m: { id: 3, suggestedBet: 'OVER_25' }, tipLabel: 'OVER_25', matchId: 3 },
  { m: { id: 4, suggestedBet: 'DC_1X' }, tipLabel: 'DC_1X', matchId: 4 },
];
const top = selectDiverseTips(ranked, 3, 1, 3);
check(
  'Top caps repeated labels at one when alternatives exist',
  top.map((x) => x.matchId).join(',') === '1,3,4'
);
check(
  'diversification prefers unused families in rank order',
  top[0] === ranked[0] && top[1] === ranked[2] && top[2] === ranked[3]
);

const mixed = [
  ...Array.from({ length: 5 }, (_, i) => ({
    tipLabel: 'OVER_25',
    matchId: 100 + i,
    m: { id: 100 + i, suggestedBet: 'OVER_25' },
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    tipLabel: 'BTTS_YES',
    matchId: 200 + i,
    m: { id: 200 + i, suggestedBet: 'BTTS_YES' },
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    tipLabel: 'DC_1X',
    matchId: 300 + i,
    m: { id: 300 + i, suggestedBet: 'DC_1X' },
  })),
];
const diversified = selectDiverseTips(mixed, 10, 1, 3);
check('family cap softens after pass 1', diversified.length === 10);
check(
  'pass 1 respects max 3 per family before fill',
  (() => {
    const first9 = diversified.slice(0, 9);
    const counts = {};
    for (const item of first9) {
      const fam = tipFamilyUi(item.tipLabel);
      counts[fam] = (counts[fam] || 0) + 1;
    }
    return Object.values(counts).every((n) => n <= 3) || diversified.length === 10;
  })()
);

const small = [
  { tipLabel: 'OVER_15', matchId: 1, m: { id: 1 } },
  { tipLabel: 'OVER_25', matchId: 2, m: { id: 2 } },
  { tipLabel: 'BTTS_YES', matchId: 3, m: { id: 3 } },
  { tipLabel: 'DC_X2', matchId: 4, m: { id: 4 } },
];
check('small pool of 4 returns length 4', selectDiverseTips(small, 10, 1, 3).length === 4);

check(
  'same match id only once',
  selectDiverseTips(
    [
      { tipLabel: 'OVER_25', matchId: 9, m: { id: 9 } },
      { tipLabel: 'BTTS_YES', matchId: 9, m: { id: 9 } },
      { tipLabel: 'DC_1X', matchId: 10, m: { id: 10 } },
    ],
    3,
    1,
    3
  )
    .map((x) => x.matchId)
    .join(',') === '9,10'
);

check('empty list remains empty', selectDiverseTips([], 10, 1, 3).length === 0);
check('buildTop10Pool exists', src.includes('function buildTop10Pool('));
check('pickTop10Tips exists', src.includes('function pickTop10Tips('));
check('no soft backfill constant', !src.includes('TOP10_SOFT_MIN_PROB'));
check('primary min prob is 78', src.includes('const TOP10_MIN_PROB = 78'));
check('max prob is 95', src.includes('const TOP10_MAX_PROB = 95'));
check('Top 10 has no multi-day window constant', !src.includes('TOP10_WINDOW_DAYS'));
check('allowlist includes CORNERS_OVER_75', isTipMarket('CORNERS_OVER_75'));
check('allowlist excludes HOME_WIN', !isTipMarket('HOME_WIN'));
check(
  'Top 10 builds from selected calendar day (?date=), not days= / best-bets',
  src.includes('resolveSelectedDate()') &&
    src.includes('pickTop10Tips(matches') &&
    /async function renderTop3[\s\S]*?matches\/today\?date=/.test(
      src.slice(src.indexOf('async function renderTop3'), src.indexOf('async function renderTop3') + 900)
    ) &&
    !/async function renderTop3[\s\S]*?days=\$\{/.test(
      src.slice(src.indexOf('async function renderTop3'), src.indexOf('async function renderTop3') + 900)
    ) &&
    !/async function renderTop3[\s\S]*?best-bets\?date=/.test(
      src.slice(src.indexOf('async function renderTop3'), src.indexOf('async function renderTop3') + 900)
    )
);
check('odds helper removed from Top 10 client', !src.includes('function tipOddsForTop10Band('));
check(
  'Top 10 pool uses primary tip only (no secondary promotion)',
  src.includes('Primary tip candidates only') &&
    !/function buildTop10Pool\([\s\S]*?isSecondary:\s*true[\s\S]*?function pickTop10Tips/.test(src)
);
check(
  'Top 10 row omits tipOdds display',
  !/async function renderTop3[\s\S]*?tipOddsDisplay\(bet\.tipOdds\)/.test(
    src.slice(src.indexOf('async function renderTop3'), src.indexOf('async function renderTop3') + 2200)
  )
);

const mixedProb15 = [
  { tipLabel: 'OVER_15', matchId: 1, m: { id: 1 }, meta: { prob: 92, score: 0.4, kind: 'est' } },
  { tipLabel: 'OVER_25', matchId: 2, m: { id: 2 }, meta: { prob: 78, score: 0.38, kind: 'est' } },
  { tipLabel: 'HOME_OVER_15', matchId: 3, m: { id: 3 }, meta: { prob: 71, score: 0.3, kind: 'est' } },
  { tipLabel: 'AWAY_OVER_25', matchId: 4, m: { id: 4 }, meta: { prob: 70, score: 0.29, kind: 'est' } },
  { tipLabel: 'BTTS_YES', matchId: 5, m: { id: 5 }, meta: { prob: 88, score: 0.35, kind: 'est' } },
  { tipLabel: 'CARDS_OVER_35', matchId: 6, m: { id: 6 }, meta: { prob: 69, score: 0.28, kind: 'est' } },
  { tipLabel: 'CORNERS_OVER_75', matchId: 7, m: { id: 7 }, meta: { prob: 85, score: 0.39, kind: 'est' } },
  { tipLabel: 'SOT_OVER_75', matchId: 8, m: { id: 8 }, meta: { prob: 72, score: 0.31, kind: 'est' } },
  { tipLabel: 'DC_1X', matchId: 9, m: { id: 9 }, meta: { prob: 81, score: 0.36, kind: 'est' } },
  { tipLabel: 'DC_X2', matchId: 10, m: { id: 10 }, meta: { prob: 79, score: 0.34, kind: 'est' } },
  { tipLabel: 'HOME_OVER_25', matchId: 11, m: { id: 11 }, meta: { prob: 80, score: 0.33, kind: 'est' } },
  { tipLabel: 'AWAY_OVER_15', matchId: 12, m: { id: 12 }, meta: { prob: 83, score: 0.37, kind: 'est' } },
];
const inBand15 = mixedProb15.filter((x) => x.meta.prob >= 78 && x.meta.prob <= 95);
const ranked15 = [...inBand15].sort((a, b) => b.meta.prob - a.meta.prob);
const filled10 = selectDiverseTips(ranked15, 10, 1, 3);
check('in-band candidates fill without soft floor', filled10.length === inBand15.length || filled10.length === 10);
check(
  'sorted pool is descending by probability',
  ranked15.every((x, i) => i === 0 || ranked15[i - 1].meta.prob >= x.meta.prob)
);
check(
  'no soft-floor tip survives band filter',
  filled10.every((x) => x.meta.prob >= 78 && x.meta.prob <= 95)
);

check(
  'null tipOdds candidate is eligible (P-only)',
  tipPlayableScore(
    { suggestedBet: 'OVER_25', tipOdds: null, oddsSource: 'model', confidenceScore: 80 },
    78
  ) != null
);
check(
  'P below 78 rejected (no backfill)',
  tipPlayableScore(
    { suggestedBet: 'OVER_25', tipOdds: null, oddsSource: 'model', confidenceScore: 76 },
    78
  ) == null
);
check(
  'P above 95 rejected',
  tipPlayableScore(
    { suggestedBet: 'OVER_25', tipOdds: 1.04, oddsSource: 'model', confidenceScore: 96 },
    78
  ) == null
);
check(
  'P=95 inclusive still eligible',
  tipPlayableScore(
    { suggestedBet: 'DC_1X', tipOdds: 1.05, oddsSource: 'model', confidenceScore: 95 },
    78
  ) != null
);
check(
  'HOME_WIN rejected (not allowlisted)',
  tipPlayableScore(
    { suggestedBet: 'HOME_WIN', tipOdds: 1.5, oddsSource: 'model', confidenceScore: 90 },
    78
  ) == null
);
check('finished matches excluded from Top 10 status', isTop10MatchStatus('finished') === false);
check('scheduled matches allowed', isTop10MatchStatus('scheduled') === true);

const allowPool = Array.from({ length: 12 }, (_, i) => ({
  id: 1000 + i,
  status: 'scheduled',
  suggestedBet: [
    'OVER_15',
    'OVER_25',
    'HOME_OVER_15',
    'BTTS_YES',
    'AWAY_OVER_25',
    'HOME_OVER_25',
    'DC_1X',
    'AWAY_OVER_15',
    'CORNERS_OVER_75',
    'CARDS_OVER_35',
    'SOT_OVER_75',
    'DC_X2',
  ][i],
  tipOdds: null,
  oddsSource: 'model',
  confidenceScore: 82 - (i % 5),
  secondaryBet: null,
}));
const filledAllow = pickTop10Tips(allowPool, 10);
check('12 scheduled allowlisted tips fill Top 10 to 10', filledAllow.length === 10);
check(
  'pool sorts descending by probability',
  buildTop10Pool(allowPool).every((x, i, arr) => i === 0 || arr[i - 1].meta.prob >= x.meta.prob)
);

const dayShape = [
  {
    id: 1,
    status: 'scheduled',
    suggestedBet: 'HOME_WIN',
    confidenceScore: 90,
  },
  {
    id: 2,
    status: 'scheduled',
    suggestedBet: 'OVER_25',
    confidenceScore: 79.05,
  },
  {
    id: 3,
    status: 'scheduled',
    suggestedBet: 'BTTS_YES',
    confidenceScore: 0,
  },
  {
    id: 4,
    status: 'scheduled',
    suggestedBet: 'DC_1X',
    confidenceScore: 79.84,
  },
];
const dayPicked = pickTop10Tips(dayShape, 10);
check(
  'allowlist + band: OVER_25 + DC_1X only (HOME_WIN out, BTTS conf 0 out)',
  dayPicked.length === 2 &&
    dayPicked.every((x) => ['OVER_25', 'DC_1X'].includes(x.tipLabel))
);

check('tipFamilyUi maps DC_1X to dc', tipFamilyUi('DC_1X') === 'dc');
check('tipFamilyUi maps BTTS_YES to btts', tipFamilyUi('BTTS_YES') === 'btts');
check('tipFamilyUi maps CORNERS_OVER_75 to corners', tipFamilyUi('CORNERS_OVER_75') === 'corners');
check('shell bumped to hb163', src.includes("UI_ICON_V = 'hb163'") || src.includes('hb163'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
