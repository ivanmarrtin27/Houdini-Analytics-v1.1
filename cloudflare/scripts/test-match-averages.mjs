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
    {
      goals_scored: 2,
      shots_for: 12,
      shots_against: 10,
      shots_on_target_for: 5,
      shots_on_target_against: 4,
      corners_for: 6,
      corners_against: 5,
      yellows_for: 2,
      yellows_against: 1,
      reds_for: 0,
    },
    {
      goals_scored: 0,
      shots_for: 8,
      shots_against: 9,
      shots_on_target_for: 3,
      shots_on_target_against: 3,
      corners_for: 4,
      corners_against: 4,
      yellows_for: 1,
      yellows_against: 2,
      reds_for: 0,
    },
  ],
  20: [
    {
      goals_scored: 1,
      shots_for: 8,
      shots_against: 11,
      shots_on_target_for: 2,
      shots_on_target_against: 5,
      corners_for: 3,
      corners_against: 6,
      yellows_for: 2,
      yellows_against: 2,
      reds_for: 0,
    },
  ],
};

const preds = {
  77: { home_xg: 1.4, away_xg: 1.1 },
};

const db = {
  async all(sql, ...params) {
    if (sql.includes('FROM matches m')) return [fixture];
    if (sql.includes('FROM team_stats')) return (stats[Number(params[0])] || []).slice(0, params[2]);
    if (sql.includes('AVG(CASE WHEN ts.is_home')) {
      return [];
    }
    return [];
  },
  async first(sql, ...params) {
    if (sql.includes('FROM predictions')) {
      return preds[Number(params[0])] || null;
    }
    if (sql.includes('AVG(CASE WHEN ts.is_home') || sql.includes('avg_home_scored')) {
      return {
        avg_home_scored: 1.4,
        avg_away_scored: 1.1,
        avg_scored: 1.25,
        avg_conceded: 1.25,
        avg_corners_for: 5,
        avg_corners_against: 5,
        avg_yellows_for: 2,
        avg_yellows_against: 2,
        avg_shots_for: 12,
        avg_shots_against: 12,
        avg_sot_for: 4.5,
        avg_sot_against: 4.5,
      };
    }
    return null;
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
assert.equal(result.matches[0].matchAvg, 2.5); // 1.4 + 1.1 xG
assert.equal(result.matches[0].homeAverage.avg, 1);
assert.equal(result.matches[0].awayAverage.avg, 1);
assert.equal(result.matches[0].coverage.complete, true);

const cards = await listMatchAveragesForDate(db, {
  date: '2026-11-05',
  metric: 'cards',
  sort: 'low',
  n: 10,
});
assert.ok(Number.isFinite(cards.matches[0].matchAvg));
assert.ok(cards.matches[0].matchAvg > 0);

const routeSource = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
assert.match(routeSource, /GET['"]?\s*&&\s*path === ['"]\/api\/v1\/stats\/match-averages['"]/);
assert.match(routeSource, /listMatchAveragesForDate/);

console.log('match averages helper + route: ok');
