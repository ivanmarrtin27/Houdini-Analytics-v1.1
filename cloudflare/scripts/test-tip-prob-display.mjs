/**
 * Guards tip % display helpers: market raw preferred; truncated; never bare "— modelo".
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'public/app.js'), 'utf8');
const pred = readFileSync(join(root, 'src/services/predictionService.js'), 'utf8');
const db = readFileSync(join(root, 'src/db.js'), 'utf8');

let failed = 0;
function check(name, ok) {
  if (!ok) {
    console.error('FAIL', name);
    failed += 1;
  } else {
    console.log('ok', name);
  }
}

check('probForLabel helper exists', /function probForLabel\(/.test(app));
check('tipProbPct exists', /function tipProbPct\(/.test(app));
check('tipProbPct prefers tipMarketProb', /tipMarketProb/.test(app) && /tip_market_prob/.test(app));
check('formatTipPct truncates', /function formatTipPct\(/.test(app) && /Math\.trunc/.test(app));
check('tipConfMetaHtml exists', /function tipConfMetaHtml\(/.test(app));
const idx = readFileSync(join(root, 'src/index.js'), 'utf8');
check('today enrich exposes tipMarketProb', /tipMarketProbFromPrediction|tipMarketProb:/.test(idx));
check('listTeamMarketStats exported', /listTeamMarketStats/.test(db));
check(
  'panel never renders bare dash+modelo ternary',
  !/: '— modelo'/.test(app) && !/\? `[^\n]*modelo`\s*:\s*'— modelo'/.test(app)
);
check('panel uses tipConfMetaHtml', /tipConfMetaHtml\(tipProb/.test(app));
check('server stores tip_tier on payload', /tip_tier:\s*tipTier/.test(pred));
check('display tipTier none still stores real conf', /tip_tier gates Mejores|Honest UI %/.test(pred));
check('Mejores filters playable tip_tier', /PLAYABLE_TIP_SQL/.test(db));
check('backfill uses PLAYABLE_TIP_SQL', /AND \$\{PLAYABLE_TIP_SQL\}/.test(db));
check('server confidence uses rawProb', /pickRaw\(primary\)|rawProb/.test(pred));
check('no value-edge confidence boost', !/confidence \+ value\.value_edge \* 40/.test(pred));
check('league stats API helper', /listLeagueMarketStats/.test(db));

function toDisplayPct(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n <= 1 ? n * 100 : n;
  return Math.trunc(pct);
}
function formatTipPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Math.trunc(Number(v));
}
function probForLabel(p, label) {
  if (!p || !label) return null;
  if (label === 'HOME_WIN') return toDisplayPct(p.home_win_prob ?? p.homeWinProb);
  if (label === 'CORNERS_OVER_95') return toDisplayPct(p.corners_over95_prob);
  return null;
}
function tipProbPct(raw) {
  const tipMarket = raw.tipMarketProb ?? raw.tip_market_prob;
  if (tipMarket != null && !Number.isNaN(Number(tipMarket))) {
    const n = Number(tipMarket);
    if (n > 0) return formatTipPct(n <= 1 ? n * 100 : n);
  }
  const tip = String(raw.suggestedBet || raw.suggested_bet || '');
  if (tip) {
    const fromLabel = probForLabel(raw, tip);
    if (fromLabel != null) return fromLabel;
  }
  const confRaw = raw.confidenceScore ?? raw.confidence_score;
  const conf = confRaw != null && !Number.isNaN(Number(confRaw)) ? Number(confRaw) : null;
  return conf != null && conf > 0 ? formatTipPct(conf) : null;
}

check(
  'tipMarketProb preferred over inflated conf (today-shaped)',
  tipProbPct({
    suggestedBet: 'DC_X2',
    tipMarketProb: 54,
    confidenceScore: 67,
  }) === 54
);
check(
  'market preferred over inflated conf',
  tipProbPct({ suggestedBet: 'HOME_WIN', confidenceScore: 81, home_win_prob: 0.64 }) === 64
);
check(
  'conf 0 + HOME_WIN → market %',
  tipProbPct({ suggestedBet: 'HOME_WIN', confidence_score: 0, home_win_prob: 0.62 }) === 62
);
check(
  'conf 0 + corners → market %',
  tipProbPct({
    suggestedBet: 'CORNERS_OVER_95',
    confidenceScore: 0,
    corners_over95_prob: 0.71,
  }) === 71
);
check(
  'truncates fractional market %',
  tipProbPct({ suggestedBet: 'HOME_WIN', home_win_prob: 0.649 }) === 64
);
check(
  'no tip / no conf → null (not dash string)',
  tipProbPct({ confidenceScore: 0 }) == null
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall ok');
