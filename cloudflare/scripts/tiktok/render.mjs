#!/usr/bin/env node
/**
 * Houdini Analytics — TikTok Fase 1 static renderer
 * Renders cover + tip-card PNGs (1080×1920) from JSON. No auto-publish.
 *
 * Usage:
 *   node scripts/tiktok/render.mjs
 *   node scripts/tiktok/render.mjs --input content/tiktok/sample-input.json
 *   node scripts/tiktok/render.mjs --chrome "C:/path/to/chrome.exe"
 */

import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CF_ROOT = resolve(__dirname, '../..');
const CONTENT = join(CF_ROOT, 'content', 'tiktok');
const TEMPLATES = join(CONTENT, 'templates');
const ASSETS = join(CONTENT, 'assets');
const DEFAULT_OUT = join(CONTENT, 'out');
const DEFAULT_INPUT = join(CONTENT, 'sample-input.json');
const W = 1080;
const H = 1920;

const MARKET_LABELS_ES = Object.freeze({
  OVER_15: 'Más de 1,5 goles',
  HOME_OVER_15: 'Local · Más de 1,5 goles',
  AWAY_OVER_15: 'Visitante · Más de 1,5 goles',
  OVER_25: 'Más de 2,5 goles',
  HOME_OVER_25: 'Local · Más de 2,5 goles',
  AWAY_OVER_25: 'Visitante · Más de 2,5 goles',
  BTTS_YES: 'Ambos equipos marcan',
  DC_1X: 'Doble oportunidad 1X',
  DC_X2: 'Doble oportunidad X2',
  CARDS_OVER_35: 'Más de 3,5 amarillas',
  CORNERS_OVER_75: 'Más de 7,5 córners',
  SOT_OVER_75: 'Más de 7,5 tiros a puerta',
});

function parseArgs(argv) {
  const out = { input: DEFAULT_INPUT, outDir: DEFAULT_OUT, chrome: null, keepHtml: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input' && argv[i + 1]) out.input = resolve(argv[++i]);
    else if (a === '--out' && argv[i + 1]) out.outDir = resolve(argv[++i]);
    else if (a === '--chrome' && argv[i + 1]) out.chrome = argv[++i];
    else if (a === '--keep-html') out.keepHtml = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function findChrome(explicit) {
  if (explicit && existsSync(explicit)) return explicit;
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fill(template, map) {
  let html = template;
  for (const [key, value] of Object.entries(map)) {
    html = html.replaceAll(`{{${key}}}`, escapeHtml(value));
  }
  return html;
}

function formatDateDisplay(isoOrDisplay) {
  if (!isoOrDisplay) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoOrDisplay)) return isoOrDisplay;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoOrDisplay));
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return String(isoOrDisplay);
}

function marketLabel(tip) {
  if (tip.marketLabel) return tip.marketLabel;
  const code = String(tip.marketCode || '').toUpperCase();
  return MARKET_LABELS_ES[code] || code || 'Señal del modelo';
}

function runChromeScreenshot(chromePath, htmlPath, pngPath) {
  const fileUrl = pathToFileURL(htmlPath).href;
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${W},${H}`,
    `--screenshot=${pngPath}`,
    fileUrl,
  ];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(chromePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 && existsSync(pngPath)) resolvePromise(pngPath);
      else reject(new Error(`Chrome screenshot failed (code ${code}): ${stderr.slice(0, 500)}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node scripts/tiktok/render.mjs [--input JSON] [--out DIR] [--chrome PATH]
Renders 1080×1920 cover + tip PNGs. No TikTok upload.`);
    process.exit(0);
  }

  const chrome = findChrome(args.chrome);
  if (!chrome) {
    console.error('Chrome/Edge not found. Pass --chrome PATH or set CHROME_PATH.');
    process.exit(1);
  }

  if (!existsSync(args.input)) {
    console.error(`Input JSON not found: ${args.input}`);
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(args.input, 'utf8'));
  const dateDisplay = data.dateDisplay || formatDateDisplay(data.date);
  const cover = data.cover || {};
  const meta = data.meta || {};
  const tips = Array.isArray(data.tips) ? data.tips : [];

  const logoSrc = join(ASSETS, 'houdini-analytics-icon.png');
  if (!existsSync(logoSrc)) {
    const fallback = join(CF_ROOT, 'public', 'brand', 'houdini-analytics-icon.png');
    if (!existsSync(fallback)) {
      console.error('Brand logo missing under content/tiktok/assets or public/brand.');
      process.exit(1);
    }
    mkdirSync(ASSETS, { recursive: true });
    copyFileSync(fallback, logoSrc);
  }

  mkdirSync(args.outDir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'hb-tiktok-'));
  const logoWork = join(work, 'houdini-analytics-icon.png');
  copyFileSync(logoSrc, logoWork);
  const logoUrl = pathToFileURL(logoWork).href;

  const coverTpl = readFileSync(join(TEMPLATES, 'cover.html'), 'utf8');
  const tipTpl = readFileSync(join(TEMPLATES, 'tip-card.html'), 'utf8');

  const stamp = String(data.date || dateDisplay).replace(/[^\d]/g, '') || 'sample';
  const written = [];

  try {
    const coverHtml = fill(coverTpl, {
      LOGO_URL: logoUrl,
      EYEBROW: cover.eyebrow || 'ANALISIS DE DATOS',
      TITLE: cover.title || 'ESTADISTICAS',
      DATE: dateDisplay,
      CTA: cover.cta || 'DESLIZA PARA VER',
    });
    const coverHtmlPath = join(work, 'cover.html');
    writeFileSync(coverHtmlPath, coverHtml, 'utf8');
    const coverPng = join(args.outDir, `cover-${stamp}.png`);
    await runChromeScreenshot(chrome, coverHtmlPath, coverPng);
    written.push(coverPng);
    console.log(`OK cover → ${coverPng}`);

    const maxTips = Math.min(tips.length, 5);
    for (let i = 0; i < maxTips; i++) {
      const tip = tips[i];
      const tipHtml = fill(tipTpl, {
        LOGO_URL: logoUrl,
        TAG: meta.tag || 'Tip del día',
        DATE: dateDisplay,
        LEAGUE: tip.league || 'Fútbol',
        HOME: tip.home || 'Local',
        AWAY: tip.away || 'Visitante',
        MARKET: marketLabel(tip),
        PROB: String(Math.trunc(Number(tip.probPct) || 0)),
        DISCLAIMER:
          meta.disclaimer ||
          'Modelo estadístico (Poisson). Contenido informativo · no es consejo financiero ni de juego.',
        HANDLE: meta.handle || 'houdini.analytics',
      });
      const tipHtmlPath = join(work, `tip-${i + 1}.html`);
      writeFileSync(tipHtmlPath, tipHtml, 'utf8');
      const tipPng = join(args.outDir, `tip-${stamp}-${i + 1}.png`);
      await runChromeScreenshot(chrome, tipHtmlPath, tipPng);
      written.push(tipPng);
      console.log(`OK tip ${i + 1} → ${tipPng}`);
    }

    if (args.keepHtml) {
      const keepDir = join(args.outDir, '_html');
      mkdirSync(keepDir, { recursive: true });
      for (const name of ['cover.html', ...Array.from({ length: maxTips }, (_, i) => `tip-${i + 1}.html`)]) {
        const src = join(work, name);
        if (existsSync(src)) copyFileSync(src, join(keepDir, name));
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  console.log(`Done. ${written.length} PNG(s) in ${args.outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
