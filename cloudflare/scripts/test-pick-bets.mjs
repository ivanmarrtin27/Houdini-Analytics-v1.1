/**
 * Regression tests for tip selection (allowlisted markets, P-only ranking).
 * Playable primary (P 78–95%) enters tip_results. BTTS_YES allowed as primary.
 * tipTier 'none' + displayPrimary for suggested_bet when nothing in band.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TIP_MARKET_SET,
  TIP_MIN_PROB,
  TIP_MAX_PROB,
  TIP_TRIVIAL_LABELS,
  isTipMarket,
  isTrivialTipLabel as isTrivialTipMarketLabel,
} from '../src/services/tipMarkets.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(HERE, '../src/services/predictionService.js'), 'utf8');

function extractFunction(name) {
  const idx = SRC.indexOf(`function ${name}(`);
  if (idx < 0) throw new Error(`function ${name} not found`);
  const start = SRC.lastIndexOf('\n', idx) + 1;
  const paren = SRC.indexOf('(', idx);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let i = paren; i < SRC.length; i += 1) {
    if (SRC[i] === '(') parenDepth += 1;
    else if (SRC[i] === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = SRC.indexOf('{', i);
        break;
      }
    }
  }
  let depth = 0;
  for (let i = bodyStart; i < SRC.length; i += 1) {
    if (SRC[i] === '{') depth += 1;
    else if (SRC[i] === '}') {
      depth -= 1;
      if (depth === 0) return SRC.slice(start, i + 1);
    }
  }
  throw new Error(`function ${name} not closed`);
}

const functions = [
  'familyOf',
  'isExtraFamily',
  'secondaryTipScore',
  'tipProbabilityAllowed',
  'dailyQuotaCandidates',
  'dailyFamilyCount',
  'tipOddsForCandidate',
  'isBannedShotTotalLabel',
  'isTrivialTipLabel',
  'isPlayableCandidate',
  'playableTipScore',
  'oddsQualityPenalty',
  'compareTipCandidates',
  'meetsDisplayFloor',
  'pickDisplayPrimary',
  'pickBets',
].map(extractFunction);

const trivialTips = ['UNDER_35', 'HOME_UNDER_35', 'AWAY_UNDER_35'];
const api = new Function(
  'TIP_MARKET_SET',
  'TIP_MIN_PROB',
  'TIP_MAX_PROB',
  'TIP_TRIVIAL_LABELS',
  'isTipMarket',
  'isTrivialTipMarketLabel',
  `const MIN_TIP_PROB = 0.48;
   const MAX_TIP_PROB = 0.9;
   const PLAYABLE_MIN_PROB = TIP_MIN_PROB;
   const PLAYABLE_MAX_PROB = TIP_MAX_PROB;
   const DISPLAY_MIN_PROB = PLAYABLE_MIN_PROB;
   const SAFE_TIP_PROB = 0.8;
   const MIN_VALUE = 0.05;
   const MIN_DRAW_PROB = 0.32;
   const MIN_1X2_TIP_PROB = 0.44;
   const MAX_1X2_TIP_PROB = 0.85;
   const MIN_SAMPLE_FOR_TIP = 3;
   const MIN_PLAYABLE_ODDS = 1.25;
   const MIN_TIP_BOOK_ODDS = 1.2;
   const MAX_TIP_BOOK_ODDS = 4.5;
   const MAX_LABEL_PER_DAY = 2;
   const MAX_FAMILY_DAY_SHARE = 0.35;
   const TRIVIAL_TIP_LABELS = TIP_TRIVIAL_LABELS;
   const TIP_POOL_LABELS = TIP_MARKET_SET;
   void SAFE_TIP_PROB;
   const TRIVIAL_GOAL_TIPS = new Set(${JSON.stringify(trivialTips)});
   const isFamilyBlocked = (calib, family) => (calib?.blockedFamilies || []).includes(family);
   const tipFamily = (label) => {
     const bet = label != null ? String(label) : '';
     if (['HOME_WIN','DRAW','AWAY_WIN','DC_1X','DC_X2','DNB_HOME','DNB_AWAY'].includes(bet)) return '1X2';
     if (['BTTS_YES','BTTS_NO'].includes(bet)) return 'btts';
     if (
       ['OVER_05','UNDER_05','OVER_15','UNDER_15','OVER_25','UNDER_25','OVER_35','UNDER_35','OVER_45','UNDER_45'].includes(bet) ||
       /^(HOME|AWAY)_(OVER|UNDER)_/.test(bet)
     ) return 'ou';
     if (bet.startsWith('CORNERS_')) return 'corners';
     if (bet.startsWith('CARDS_')) return 'cards';
     if (bet.startsWith('SHOTS_')) return 'shots';
     if (bet.startsWith('SOT_')) return 'shots_on_target';
     return 'otros';
   };
   ${functions.join('\n\n')}
   return { pickBets, tipProbabilityAllowed, familyOf, tipFamily, isPlayableCandidate, playableTipScore };`
)(
  TIP_MARKET_SET,
  TIP_MIN_PROB,
  TIP_MAX_PROB,
  TIP_TRIVIAL_LABELS,
  isTipMarket,
  isTrivialTipMarketLabel
);

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

const value = (entries) => ({
  byLabel: Object.fromEntries(
    Object.entries(entries).map(([label, v]) => {
      if (v != null && typeof v === 'object') {
        return [label, { edge: v.edge, book: v.book }];
      }
      return [label, { edge: v, book: null }];
    })
  ),
});

let result = api.pickBets(
  [
    { label: 'OVER_25', prob: 0.82 },
    { label: 'BTTS_YES', prob: 0.8 },
  ],
  value({
    OVER_25: { edge: 0.09, book: 1.5 },
    BTTS_YES: { edge: 0.06, book: 1.4 },
  }),
  null,
  { hasBook: true, sampleSize: 5 }
);
check('highest P wins playable lane (OVER_25 over BTTS)', result.primary.label === 'OVER_25');
check('playable primary tipTier', result.tipTier === 'playable');

result = api.pickBets(
  [
    { label: 'BTTS_YES', prob: 0.82 },
    { label: 'OVER_25', prob: 0.62 },
  ],
  value({
    BTTS_YES: { edge: 0.1, book: 1.45 },
    OVER_25: { edge: 0.08, book: 1.5 },
  }),
  null,
  { hasBook: true, sampleSize: 5 }
);
check('BTTS_YES allowed as primary when highest in band', result.primary?.label === 'BTTS_YES');
check('BTTS primary tipTier playable', result.tipTier === 'playable');

result = api.pickBets(
  [
    { label: 'HOME_WIN', prob: 0.9 },
    { label: 'OVER_25', prob: 0.62 },
  ],
  value({ HOME_WIN: 0.15, OVER_25: 0.08 }),
  null,
  { hasBook: true, sampleSize: 5 }
);
check(
  'non-allowlisted HOME_WIN ignored even at high P',
  result.primary == null && result.tipTier === 'none'
);

result = api.pickBets(
  [
    { label: 'DC_1X', prob: 0.43 },
    { label: 'OVER_25', prob: 0.59 },
  ],
  value({ DC_1X: 0.15, OVER_25: 0.08 }),
  null,
  { hasBook: true, sampleSize: 5 }
);
check(
  'sub-78% yields no Stats primary (tipTier none) but has displayPrimary',
  result.primary == null && result.tipTier === 'none' && result.displayPrimary?.label != null
);

result = api.pickBets(
  [
    { label: 'DC_1X', prob: 0.52 },
    { label: 'OVER_25', prob: 0.78 },
    { label: 'DC_X2', prob: 0.48 },
  ],
  value({
    DC_1X: { edge: 0.12, book: 2.1 },
    OVER_25: { edge: 0.06, book: 1.55 },
    DC_X2: { edge: 0.1, book: 2.4 },
  }),
  null,
  { hasBook: true, sampleSize: 5 }
);
check('playable prefers ≥78% OVER_25', result.primary?.label === 'OVER_25');
check('displayPrimary mirrors playable primary', result.displayPrimary?.label === 'OVER_25');

result = api.pickBets(
  [
    { label: 'DC_1X', prob: 0.51 },
    { label: 'OVER_25', prob: 0.55 },
    { label: 'BTTS_YES', prob: 0.49 },
  ],
  value({
    DC_1X: { edge: 0.08, book: 2.0 },
    OVER_25: { edge: 0.05, book: 1.9 },
    BTTS_YES: { edge: 0.04, book: 1.85 },
  }),
  null,
  { hasBook: true, sampleSize: 5 }
);
check(
  'only low-P markets → tipTier none + displayPrimary schema fallback',
  result.primary == null &&
    result.tipTier === 'none' &&
    result.displayPrimary?.label != null &&
    Number(result.displayPrimary.prob) < 0.78
);

result = api.pickBets(
  [
    { label: 'BTTS_YES', prob: 0.78 },
    { label: 'OVER_25', prob: 0.79 },
    { label: 'DC_1X', prob: 0.79 },
  ],
  value({
    BTTS_YES: { edge: 0.14, book: 1.4 },
    OVER_25: { edge: 0.08, book: 1.5 },
    DC_1X: { edge: 0.06, book: 1.55 },
  }),
  null,
  {
    hasBook: true,
    sampleSize: 5,
    dailyTipContext: {
      fixtureCount: 10,
      maxPerLabel: 4,
      counts: { BTTS_YES: 4, OVER_25: 4, DC_1X: 0 },
    },
  }
);
check('daily label quota prefers under-cap playable (DC_1X)', result.primary.label === 'DC_1X');

const rotatingCounts = {};
const fixtureCandidates = [
  { label: 'OVER_25', prob: 0.79 },
  { label: 'DC_1X', prob: 0.79 },
  { label: 'BTTS_YES', prob: 0.79 },
];
const fixtureEdges = value({
  OVER_25: { edge: 0.1, book: 1.5 },
  DC_1X: { edge: 0.09, book: 1.5 },
  BTTS_YES: { edge: 0.08, book: 1.5 },
});
for (let i = 0; i < 6; i += 1) {
  const picked = api.pickBets(fixtureCandidates, fixtureEdges, null, {
    hasBook: true,
    sampleSize: 5,
    dailyTipContext: { fixtureCount: 10, maxPerLabel: 2, counts: rotatingCounts },
  }).primary?.label;
  if (picked) rotatingCounts[picked] = (rotatingCounts[picked] || 0) + 1;
}
check(
  'six sequential playable picks respect max 2 per label',
  Math.max(...Object.values(rotatingCounts)) <= 2 &&
    (rotatingCounts.OVER_25 || 0) === 2 &&
    (rotatingCounts.DC_1X || 0) === 2 &&
    (rotatingCounts.BTTS_YES || 0) === 2
);

result = api.pickBets(
  [
    { label: 'OVER_25', prob: 0.79 },
    { label: 'BTTS_YES', prob: 0.78 },
    { label: 'HOME_WIN', prob: 0.95 },
  ],
  value({
    OVER_25: { edge: 0.1, book: 1.5 },
    BTTS_YES: { edge: 0.09, book: 1.5 },
    HOME_WIN: { edge: 0.2, book: 1.2 },
  }),
  null,
  { hasBook: true, sampleSize: 5 }
);
check('primary is allowlisted (not HOME_WIN)', result.primary?.label !== 'HOME_WIN');
check('primary is highest allowlisted P', result.primary?.label === 'OVER_25');

check(
  'playable ignores short book odds (P-only)',
  api.isPlayableCandidate({ label: 'OVER_25', prob: 0.8, book: 1.05 }) === true
);
check(
  'playable rejects above 95%',
  api.isPlayableCandidate({ label: 'OVER_25', prob: 0.96 }) === false
);
check(
  'playableTipScore ranks by P',
  api.playableTipScore({ label: 'OVER_25', prob: 0.9 }, null) >
    api.playableTipScore({ label: 'OVER_25', prob: 0.8 }, null)
);

result = api.pickBets(
  [
    { label: 'SOT_OVER_75', prob: 0.81 },
    { label: 'CORNERS_OVER_75', prob: 0.8 },
    { label: 'CARDS_OVER_35', prob: 0.79 },
  ],
  value({}),
  null,
  {
    hasBook: false,
    sampleSize: 5,
    extraCandidates: [
      { label: 'SOT_OVER_75', prob: 0.81 },
      { label: 'CORNERS_OVER_75', prob: 0.8 },
      { label: 'CARDS_OVER_35', prob: 0.79 },
    ],
  }
);
check('extras allowlist SOT/corners/cards compete by P', result.primary?.label === 'SOT_OVER_75');

result = api.pickBets(
  [{ label: 'SHOTS_OVER_255', prob: 0.9 }],
  value({}),
  null,
  {
    hasBook: false,
    sampleSize: 5,
    extraCandidates: [{ label: 'SHOTS_OVER_255', prob: 0.9 }],
  }
);
check('SHOTS_* never primary', result.primary == null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
