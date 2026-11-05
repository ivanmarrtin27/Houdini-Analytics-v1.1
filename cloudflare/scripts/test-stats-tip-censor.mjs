/** Ensure Aciertos only blurs the bet and keeps the outcome visible. */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(resolve(HERE, '../public/app.js'), 'utf8');
function extractFunction(name) {
  const start = APP.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} not found`);
  const brace = APP.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < APP.length; i += 1) {
    if (APP[i] === '{') depth += 1;
    else if (APP[i] === '}') {
      depth -= 1;
      if (depth === 0) return APP.slice(start, i + 1);
    }
  }
  throw new Error(`${name} is not closed`);
}

const helpers = new Function(
  `function escapeHtml(value) {
     return String(value ?? '').replace(/[&<>"']/g, (char) => ({
       '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
     })[char]);
   }
   function labelBet() { return 'M├ís de 1,5 goles'; }
   function formatMatchDate() { return '03/11/2026'; }
   function leagueLabelEs(value) { return value; }
   function crestHtml() { return ''; }
   function outcomeBadge(outcome) {
     return outcome === 'hit' ? '<span class="outcome">Acert├│</span>' :
       outcome === 'miss' ? '<span class="outcome">Fall├│</span>' : '<span>ÔÇö</span>';
   }
   function contentUnlocked() { return false; }
   function t() { return 'Solo suscriptores ÔÇö desbloquea con Houdini Premium'; }
   ${extractFunction('perfTipDisplayHtml')}
   ${extractFunction('recentTipRowHtml')}
   return { perfTipDisplayHtml, recentTipRowHtml };`
)();

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

const censoredTip = helpers.perfTipDisplayHtml('M├ís de 1,5 goles');
check(
  'free recommendation uses a compact Premium pill, not the oversized block CTA',
  censoredTip.includes('perf-row__tip-lock') &&
    censoredTip.includes('perf-row__tip-premium') &&
    !censoredTip.includes('hb-censor__lock-btn')
);

for (const [outcome, label] of [['hit', 'Acert├│'], ['miss', 'Fall├│']]) {
  const row = helpers.recentTipRowHtml({
    matchId: 7,
    homeName: 'Local',
    awayName: 'Visitante',
    suggestedBet: 'OVER_15',
    outcome,
    leagueName: 'Liga',
    matchDate: '2026-11-03',
    matchStatus: 'live',
  });
  const hidden = row.indexOf('data-hb-censor');
  const bet = row.indexOf('M├ís de 1,5 goles');
  const lockClose = row.indexOf('</span></span>', bet);
  const lockEnd = lockClose < 0 ? -1 : lockClose + '</span></span>'.length;
  const outcomeAt = row.indexOf(`>${label}</span>`);
  check(`${label} keeps the bet text within the censor wrapper`, hidden >= 0 && bet > hidden && lockEnd > bet);
  check(`${label} remains visible after the censored bet`, outcomeAt > lockEnd);
  check(`${label} live row identifies the match as in progress`, row.includes('En vivo'));
}

console.log(failed ? `\n${failed} check(s) failed` : `\n${passed}/${passed} checks passed`);
process.exit(failed ? 1 : 0);
