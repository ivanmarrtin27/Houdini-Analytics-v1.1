/**
 * Fix UTF-8 mojibake in public + pages UI sources (PowerShell-safe: run via node).
 * Replaces known mis-decoded sequences; does not latin1-decode whole files
 * (that would corrupt already-correct Unicode).
 *
 * Usage:
 *   node scripts/fix-mojibake.mjs          # apply fixes
 *   node scripts/fix-mojibake.mjs --scan   # report only
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const roots = [
  path.join(__dirname, '..', 'public'),
  path.join(__dirname, '..', 'pages'),
];
const files = ['app.js', 'index.html', 'styles.css', 'sw.js', 'manifest.webmanifest'];
const scanOnly = process.argv.includes('--scan');

// Longest-first; prefer \u escapes so the script source stays ASCII-safe on Windows.
const REPLACEMENTS = [
  // double-encoded Latin (å's second byte is YEN U+00A5 when double-mojibaked)
  ['\u00C3\u0192\u00C2\u00E1', 'á'],
  ['\u00C3\u0192\u00C2\u00E9', 'é'],
  ['\u00C3\u0192\u00C2\u00ED', 'í'],
  ['\u00C3\u0192\u00C2\u00F3', 'ó'],
  ['\u00C3\u0192\u00C2\u00FA', 'ú'],
  ['\u00C3\u0192\u00C2\u00F1', 'ñ'],
  ['\u00C3\u0192\u00C2\u00FC', 'ü'],
  ['\u00C3\u0192\u00C2\u00E7', 'ç'],
  ['\u00C3\u0192\u00C2\u00A5', 'å'],
  ['\u00C3\u00AF\u00C2\u00BF\u00C2\u00BD', ''],
  // single-level punctuation / symbols
  ['\u00E2\u20AC\u201D', '—'],
  ['\u00E2\u20AC\u201C', '–'],
  ['\u00E2\u20AC\u00A6', '…'],
  ['\u00E2\u20AC\u00AC', '€'],
  ['\u00E2\u20AC\u00BA', '›'],
  ['\u00E2\u20AC\u00A2', '•'],
  ['\u00E2\u2020\u2019', '→'],
  ['\u00E2\u2020\u2018', '←'],
  ['\u00E2\u2020\u201D', '↔'],
  ['\u00E2\u0153\u201C', '✓'],
  ['\u00E2\u0153\u201D', '✔'],
  ['\u00E2\u0153\u2014', '✗'],
  ['\u00E2\u0153\u02DC', '✘'],
  ['\u00E2\u0153\u2022', '✕'],
  ['\u00E2\u2030\u00A5', '≥'],
  ['\u00E2\u2030\u00A4', '≤'],
  ['\u00E2\u2030\u00A0', '≠'],
  ['\u00E2\u2030\u02C6', '≈'],
  ['\u00E2\u20AC\u00B2', '′'],
  ['\u00C2\u00B7', '·'],
  ['\u00C2\u00AB', '«'],
  ['\u00C2\u00BB', '»'],
  ['\u00C2\u00BF', '¿'],
  ['\u00C2\u00A1', '¡'],
  ['\u00C2\u00A0', '\u00A0'],
  // Spanish / Latin letters
  ['\u00C3\u00A1', 'á'],
  ['\u00C3\u00A9', 'é'],
  ['\u00C3\u00AD', 'í'],
  ['\u00C3\u00B3', 'ó'],
  ['\u00C3\u00BA', 'ú'],
  ['\u00C3\u00B1', 'ñ'],
  ['\u00C3\u00BC', 'ü'],
  ['\u00C3\u00A7', 'ç'],
  ['\u00C3\u00B8', 'ø'],
  ['\u00C3\u00A6', 'æ'],
  ['\u00C3\u00A5', 'å'],
  ['\u00C3\u0081', 'Á'],
  ['\u00C3\u0089', 'É'],
  ['\u00C3\u008D', 'Í'],
  ['\u00C3\u0093', 'Ó'],
  ['\u00C3\u009A', 'Ú'],
  ['\u00C3\u0091', 'Ñ'],
  ['\u00C3\u009C', 'Ü'],
  ['\u00C3\u0080', 'À'],
  ['\u00C3\u0088', 'È'],
  ['\u00C3\u0092', 'Ò'],
  ['\u00C3\u00A4', 'ä'],
  ['\u00C3\u00B6', 'ö'],
  ['\u00C3\u00A3', 'ã'],
  ['\u00C3\u00A2', 'â'],
  ['\u00C3\u00AA', 'ê'],
  ['\u00C3\u00B4', 'ô'],
  ['\u00CE\u00BB', 'λ'],
  ['\u00CE\u00A3', 'Σ'],
  ['\u00C3\u0097', '×'],
  ['\u00C3\u0085', 'Å'],
  ['\u00C3\u0084', 'Ä'],
];

function fixText(text) {
  let out = text;
  let changed = true;
  let passes = 0;
  while (changed && passes < 4) {
    changed = false;
    passes += 1;
    for (const [bad, good] of REPLACEMENTS) {
      if (out.includes(bad)) {
        out = out.split(bad).join(good);
        changed = true;
      }
    }
  }
  return { out, passes };
}

function suspectCount(text) {
  return (text.match(/Ã[\x80-\xBF]|â€|Â[·«»¿¡ ]|Ãƒ|âœ|â†|â‰|âˆ|âŒ|Î[»£]/g) || []).length;
}

const report = [];
for (const root of roots) {
  for (const f of files) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) {
      report.push({ file: path.relative(path.join(__dirname, '..'), p).replace(/\\/g, '/'), missing: true });
      continue;
    }
    const before = fs.readFileSync(p, 'utf8');
    const { out, passes } = fixText(before);
    const still = suspectCount(out);
    if (!scanOnly && before !== out) {
      fs.writeFileSync(p, out, { encoding: 'utf8' });
    }
    report.push({
      file: path.relative(path.join(__dirname, '..'), p).replace(/\\/g, '/'),
      changed: before !== out,
      passes,
      stillSuspect: still,
      mananaOk: out.includes('Mañana'),
      analisisOk: out.includes('Análisis'),
    });
  }
}
console.log(JSON.stringify({ scanOnly, report }, null, 2));
