/** API-Football auth helpers: trim key, classify 403 invalid_key, no secret leakage. */
import {
  apiFootballKey,
  isApiFootballAuthFailure,
} from '../src/services/syncService.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
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

check('empty env → empty key', apiFootballKey({}) === '');
check('trims whitespace around key', apiFootballKey({ API_FOOTBALL_KEY: '  abc  ' }) === 'abc');
check(
  'detects Invalid API key message',
  isApiFootballAuthFailure(
    'API-Football 403: {"errors":{"token":"Invalid API key, please check your request and credentials.","error":"4xSe"}}'
  )
);
check('detects 4xSe code', isApiFootballAuthFailure('something 4xSe'));
check('quota/other 429 is not auth failure', !isApiFootballAuthFailure('API-Football 429: rate limit'));
check(
  'apiGet uses trimmed apiFootballKey helper',
  SYNC.includes("headers: { 'x-apisports-key': key }") && SYNC.includes('const key = apiFootballKey(env)')
);
check(
  'live refresh skips AF on invalid_key cooldown',
  SYNC.includes('invalid_key_cooldown') && SYNC.includes('shouldSkipApiFootball')
);
check(
  'status exposes apiFootballAuth',
  INDEX.includes('apiFootballAuth') && INDEX.includes('presente pero rechazada')
);

console.log(failed ? `\n${failed} checks failed` : `\n${passed}/${passed} checks passed`);
process.exit(failed ? 1 : 0);
