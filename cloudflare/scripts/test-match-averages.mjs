import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { listMatchAveragesForDate } from '../src/db.js';

const fixture = {
  id: 77,
  league_id: 1,
  league_api_id: 140,
  league_name: 'LaLiga',
  league_country: 'Spain',
  league_logo: null,
  match_date: '2026-11-05 20:00:00',
  status: 'scheduled',
  home_team_id: 10,
  home_name: 'Local',
  home_logo: null,
  away_team_id: 20,
  away_name: 'Visitante',
  away_logo: null,
};

const stats = {
  10: [
    { goals_scored: 2, shots_for: 12, shots_on_target_for: 5, corners_for: 6, yellows_for: 2, reds_for: 1 },
    { goals_scored: 0, shots_for: null, shots_on_target_for: 3, corners_for: 4, yellows_for: 1, reds_for: 0 },
  ],
  20: [
    { goals_scored: 1, shots_for: 8, shots_on_target_for: 2, corners_for: 3, yellows_for: null, reds_for: null },
  ],
};

const db = {
  async all(sql, ...params) {
    if (sql.includes('FROM matches m')) return [fixture];
    if (sql.includes('FROM team_stats')) return (stats[Number(params[0])] || []).slice(0, params[2]);
    return [];
  },
};

const result = await listMatchAveragesForDate(db, {
  date: '2026-11-05',
  metric: 'goals',
  sort: 'high',
  n: 10,
});
assert.equal(result.meta.total, 1);
assert.equal(result.meta.withData, 1);
assert.equal(result.matches[0].matchAvg, 2);
assert.equal(result.matches[0].homeAverage.avg, 1);
assert.equal(result.matches[0].homeAverage.sample, 2);
assert.equal(result.matches[0].awayAverage.avg, 1);
assert.equal(result.matches[0].coverage.complete, true);

const cards = await listMatchAveragesForDate(db, {
  date: '2026-11-05',
  metric: 'cards',
  sort: 'low',
  n: 10,
});
assert.equal(cards.matches[0].homeAverage.avg, 2);
assert.equal(cards.matches[0].awayAverage.avg, null);
assert.equal(cards.matches[0].matchAvg, 2);
assert.equal(cards.matches[0].coverage.partial, true);

const routeSource = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
assert.match(routeSource, /GET['"]?\s*&&\s*path === ['"]\/api\/v1\/stats\/match-averages['"]/);
assert.match(routeSource, /listMatchAveragesForDate/);

console.log('match averages helper + route: ok');
