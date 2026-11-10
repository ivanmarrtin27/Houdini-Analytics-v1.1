import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const pages = read('pages/app.js');
const pub = read('public/app.js');
const adminHtml = read('admin-pages/index.html');
const adminApp = read('admin-pages/app.js');
const adminCss = read('admin-pages/styles.css');
const statsJs = fs.existsSync(path.join(ROOT, 'admin-pages/stats-public.js'))
  ? read('admin-pages/stats-public.js')
  : '';
const statsCss = fs.existsSync(path.join(ROOT, 'admin-pages/stats-public.css'))
  ? read('admin-pages/stats-public.css')
  : '';

const checks = [];
const ok = (id, pass, detail = '') => checks.push({ id, pass: Boolean(pass), detail });

function sliceBetween(src, startMark, endMark) {
  const a = src.indexOf(startMark);
  const b = src.indexOf(endMark);
  if (a < 0 || b < 0 || b <= a) return null;
  return src.slice(a, b);
}

// —— Phase 1: countries ES ——
ok('P1.countryLabel', pages.includes('function countryLabel') && pub.includes('function countryLabel'));
ok(
  'P1.normalizeCountryKey',
  pages.includes('function normalizeCountryKey') && pub.includes('function normalizeCountryKey')
);
ok("P1.COUNTRY_ES.Spain", pages.includes("Spain: 'España'") && pub.includes("Spain: 'España'"));
ok(
  "P1.COUNTRY_ES.England",
  pages.includes("England: 'Inglaterra'") && pub.includes("England: 'Inglaterra'")
);
ok(
  "P1.COUNTRY_ES.International",
  pages.includes("International: 'Internacional'") && pub.includes("International: 'Internacional'")
);
ok(
  'P1.formatLeagueLine.stats',
  pages.includes('const leagueLine = formatLeagueLine') &&
    pub.includes('const leagueLine = formatLeagueLine')
);
ok(
  'P1.pages≡public.countryHelpers',
  (() => {
    const a = sliceBetween(pages, 'const COUNTRY_ISO', 'function leagueLabelEs');
    const b = sliceBetween(pub, 'const COUNTRY_ISO', 'function leagueLabelEs');
    return a != null && a === b;
  })()
);

// Smoke countryLabel using the same normalize pattern
const COUNTRY_ES = {
  Spain: 'España',
  England: 'Inglaterra',
  World: 'Internacional',
  International: 'Internacional',
};
const ALIASES = { international: 'World', holland: 'Netherlands' };
function normalize(c) {
  const raw = String(c || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  if (COUNTRY_ES[raw]) return raw;
  for (const k of Object.keys(COUNTRY_ES)) {
    if (k.toLowerCase() === lower) return k;
  }
  return raw;
}
function countryLabel(c) {
  const k = normalize(c);
  return COUNTRY_ES[k] || k;
}
ok('P1.smoke.spain', countryLabel('Spain') === 'España');
ok('P1.smoke.spain.lower', countryLabel('spain') === 'España');
ok('P1.smoke.international', countryLabel('International') === 'Internacional');

// —— Phase 2: admin login ——
ok('P2.gate.brand', adminHtml.includes('class="gate__brand">Houdini Analytics</p>'));
ok('P2.gate.product', adminHtml.includes('class="gate__product">Houdini Analytics</p>'));
ok('P2.title', adminHtml.includes('<title>Houdini Analytics · Control</title>'));
ok(
  'P2.no.HoudiniBet.gate',
  !adminHtml.includes('class="gate__brand">Houdini Bet</p>') &&
    !adminHtml.includes('class="gate__product">Houdini Bet</p>')
);
ok('P2.css.gate__product', adminCss.includes('.gate__product'));

// —— Phase 3: admin Stats = public Stats ——
ok(
  'P3.stats-public.js',
  Boolean(statsJs) &&
    statsJs.includes('AdminPublicStats') &&
    statsJs.includes('/api/v1/stats/match-averages')
);
ok('P3.stats-public.css', Boolean(statsCss) && statsCss.includes('.match-stats'));
ok(
  'P3.html.match-stats',
  adminHtml.includes('id="match-stats-list"') && adminHtml.includes('stats-public.js')
);
ok('P3.no.tips.performance', !adminApp.includes('tips/performance'));
ok('P3.AdminPublicStats.wire', adminApp.includes('AdminPublicStats'));
ok('P3.home.teaser', adminHtml.includes('Abrir Stats') && adminHtml.includes('btn-stats-all'));
ok('P3.no.Stats.tips.title', !adminHtml.includes('Stats (tips)'));

// —— Phase 4: live list sync ——
ok(
  'P4.paintPartidosLiveRow',
  pages.includes('function paintPartidosLiveRow') && pub.includes('function paintPartidosLiveRow')
);
ok(
  'P4.flushPartidosListLive',
  pages.includes('function flushPartidosListLive') && pub.includes('function flushPartidosListLive')
);
ok(
  'P4.refreshOpenPanelLive.paint',
  pages.includes('paintPartidosLiveRow(id)') && pub.includes('paintPartidosLiveRow(id)')
);
ok(
  'P4.closePanel.flush',
  pages.includes('hadLiveCtx') &&
    pages.includes('flushPartidosListLive()') &&
    pub.includes('hadLiveCtx') &&
    pub.includes('flushPartidosListLive()')
);
ok(
  'P4.pages≡public.liveHelpers',
  (() => {
    const a = sliceBetween(pages, 'function applyLiveFieldsToCached', 'async function refreshOpenPanelLive');
    const b = sliceBetween(pub, 'function applyLiveFieldsToCached', 'async function refreshOpenPanelLive');
    return a != null && a === b;
  })()
);

const failed = checks.filter((c) => !c.pass);
console.log(
  JSON.stringify(
    {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.map((f) => f.id),
      checks,
    },
    null,
    2
  )
);

if (failed.length) process.exit(1);
