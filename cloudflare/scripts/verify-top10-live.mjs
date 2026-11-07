/** One-shot: simulate Top 10 pick against production selected calendar day. */
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

if (src.includes('TOP10_WINDOW_DAYS')) {
  console.error('FAIL: TOP10_WINDOW_DAYS still present (expected day-only)');
  process.exit(2);
}
if (!/async function renderTop3[\s\S]{0,900}matches\/today\?date=/.test(src)) {
  console.error('FAIL: renderTop3 must fetch ?date=');
  process.exit(2);
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
   return { buildTop10Pool, pickTop10Tips };`
)();

const base = process.env.API_BASE_URL || 'https://houdini-bet.ivanmarrtin2703.workers.dev';
const todayYmd = new Date().toISOString().slice(0, 10);

const rDay = await fetch(`${base}/api/v1/matches/today?date=${todayYmd}`);
const dDay = await rDay.json();
const matchesDay = dDay.matches || [];
const pool = api.buildTop10Pool(matchesDay);
const picked = api.pickTop10Tips(matchesDay, 10);
console.log(
  JSON.stringify(
    {
      date: todayYmd,
      matches: matchesDay.length,
      pool: pool.length,
      picked: picked.length,
      labels: picked.map((x) => x.tipLabel),
    },
    null,
    2
  )
);
