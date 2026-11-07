/**
 * Backfill FotMob SOT/corners into team_stats for a calendar day, then settle tips.
 * Default date: 2026-11-06 (HSV SOT + Everton corners pending case).
 *
 * Usage: node scripts/repair-day-extras.mjs [YYYY-MM-DD]
 * Requires wrangler auth for remote D1. Does NOT deploy Worker/Pages.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  fotmobMatchIdFromApiId,
  fetchFotmobMatchDetails,
  normalizeFotmobStats,
} from '../src/services/matchEvents.js';
import { evaluateSuggestedBet, tipBetNeedsExtras, tipExtrasReady } from '../src/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CF_ROOT = join(__dirname, '..');
const DB = 'houdini-bet-db';

const dateArg = String(process.argv[2] || '2026-11-06').slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error('Usage: node scripts/repair-day-extras.mjs [YYYY-MM-DD]');
  process.exit(1);
}

function d1Json(sql) {
  const isWin = process.platform === 'win32';
  // Relative path only — absolute paths with spaces break wrangler on Windows.
  const tmpName = `.repair-day-extras-${process.pid}-${Date.now()}.sql`;
  const tmp = join(CF_ROOT, tmpName);
  writeFileSync(tmp, String(sql).trim() + '\n', 'utf8');
  try {
    const out = execFileSync(
      isWin ? 'npx.cmd' : 'npx',
      ['wrangler', 'd1', 'execute', DB, '--remote', '--json', `--file=${tmpName}`],
      {
        cwd: CF_ROOT,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        shell: isWin,
      }
    );
    const jsonStart = out.indexOf('[');
    const jsonStartObj = out.indexOf('{');
    const start =
      jsonStart >= 0 && (jsonStartObj < 0 || jsonStart < jsonStartObj)
        ? jsonStart
        : jsonStartObj;
    if (start < 0) throw new Error(`wrangler d1: no JSON in output:\n${out.slice(0, 400)}`);
    const parsed = JSON.parse(out.slice(start));
    const block = Array.isArray(parsed) ? parsed[0] : parsed;
    if (block?.success === false || block?.error) {
      throw new Error(JSON.stringify(block.error || block));
    }
    return block?.results ?? block?.result?.[0]?.results ?? [];
  } finally {
    try {
      unlinkSync(tmp);
    } catch (_) {
      /* ignore */
    }
  }
}

function sqlStr(v) {
  if (v == null) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlNum(v) {
  if (v == null || !Number.isFinite(Number(v))) return 'NULL';
  return String(Number(v));
}

console.log(`repair-day-extras date=${dateArg}`);

const rows = d1Json(`
  SELECT m.id, m.api_id, m.fotmob_match_id, m.match_date, m.home_goals, m.away_goals,
         m.home_team_id, m.away_team_id,
         ht.name AS home_name, at.name AS away_name,
         p.suggested_bet AS pred_tip,
         tr.suggested_bet AS tip_label,
         tr.outcome AS tip_outcome,
         hs.corners_for AS home_corners,
         aw.corners_for AS away_corners,
         hs.shots_on_target_for AS home_sot,
         aw.shots_on_target_for AS away_sot
  FROM matches m
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams at ON at.id = m.away_team_id
  LEFT JOIN predictions p ON p.match_id = m.id
  LEFT JOIN tip_results tr ON tr.match_id = m.id
  LEFT JOIN team_stats hs ON hs.match_id = m.id AND hs.team_id = m.home_team_id
  LEFT JOIN team_stats aw ON aw.match_id = m.id AND aw.team_id = m.away_team_id
  WHERE date(m.match_date) = date('${dateArg}')
    AND m.status = 'finished'
    AND m.home_goals IS NOT NULL AND m.away_goals IS NOT NULL
`);

const targets = (rows || []).filter((r) => {
  const label = r.tip_label || r.pred_tip;
  if (!tipBetNeedsExtras(label)) return false;
  const o = String(r.tip_outcome || 'pending').toLowerCase();
  const missingExtras =
    (String(label).startsWith('CORNERS_') &&
      (r.home_corners == null || r.away_corners == null)) ||
    (String(label).startsWith('SOT_') && (r.home_sot == null || r.away_sot == null));
  return o === 'pending' || r.tip_outcome == null || missingExtras;
});

console.log(`finished rows=${(rows || []).length} prop targets=${targets.length}`);

let updated = 0;
const settled = [];

for (const row of targets) {
  let fotmobId =
    row.fotmob_match_id != null && Number(row.fotmob_match_id) > 0
      ? Number(row.fotmob_match_id)
      : null;
  if (!fotmobId) fotmobId = fotmobMatchIdFromApiId(row.api_id);
  if (!fotmobId) {
    console.warn(`skip match ${row.id} ${row.home_name}-${row.away_name}: no fotmob id`);
    continue;
  }

  let details;
  try {
    details = await fetchFotmobMatchDetails(fotmobId);
  } catch (err) {
    console.warn(`FotMob fail match ${row.id}:`, err.message || err);
    continue;
  }
  const stats = normalizeFotmobStats(details);
  const vals = [
    stats.home.corners,
    stats.away.corners,
    stats.home.yellows,
    stats.away.yellows,
    stats.home.shots,
    stats.away.shots,
    stats.home.shotsOnTarget,
    stats.away.shotsOnTarget,
  ];
  if (vals.every((v) => v == null)) {
    console.warn(`skip match ${row.id}: FotMob returned no extras`);
    continue;
  }

  const matchDate = String(row.match_date).replace('T', ' ').slice(0, 19);
  const upsert = (teamId, isHome, side, opp) => `
    INSERT INTO team_stats
      (team_id, match_id, goals_scored, goals_conceded, corners_for, corners_against,
       yellows_for, yellows_against, reds_for, reds_against, fouls_for, fouls_against,
       shots_for, shots_against, shots_on_target_for, shots_on_target_against,
       is_home, match_date)
    VALUES (
      ${sqlNum(teamId)}, ${sqlNum(row.id)},
      ${sqlNum(isHome ? row.home_goals : row.away_goals)},
      ${sqlNum(isHome ? row.away_goals : row.home_goals)},
      ${sqlNum(side.corners)}, ${sqlNum(opp.corners)},
      ${sqlNum(side.yellows)}, ${sqlNum(opp.yellows)},
      NULL, NULL, NULL, NULL,
      ${sqlNum(side.shots)}, ${sqlNum(opp.shots)},
      ${sqlNum(side.shotsOnTarget)}, ${sqlNum(opp.shotsOnTarget)},
      ${isHome ? 1 : 0}, ${sqlStr(matchDate)}
    )
    ON CONFLICT(match_id, team_id) DO UPDATE SET
      corners_for = COALESCE(excluded.corners_for, team_stats.corners_for),
      corners_against = COALESCE(excluded.corners_against, team_stats.corners_against),
      yellows_for = COALESCE(excluded.yellows_for, team_stats.yellows_for),
      yellows_against = COALESCE(excluded.yellows_against, team_stats.yellows_against),
      shots_for = COALESCE(excluded.shots_for, team_stats.shots_for),
      shots_against = COALESCE(excluded.shots_against, team_stats.shots_against),
      shots_on_target_for = COALESCE(excluded.shots_on_target_for, team_stats.shots_on_target_for),
      shots_on_target_against = COALESCE(excluded.shots_on_target_against, team_stats.shots_on_target_against),
      match_date = excluded.match_date
  `;

  d1Json(upsert(row.home_team_id, true, stats.home, stats.away));
  d1Json(upsert(row.away_team_id, false, stats.away, stats.home));
  if (row.fotmob_match_id == null) {
    d1Json(
      `UPDATE matches SET fotmob_match_id = ${sqlNum(fotmobId)} WHERE id = ${sqlNum(row.id)}`
    );
  }
  updated += 1;

  const cornersTotal =
    stats.home.corners != null && stats.away.corners != null
      ? Number(stats.home.corners) + Number(stats.away.corners)
      : null;
  const yellowsTotal =
    stats.home.yellows != null && stats.away.yellows != null
      ? Number(stats.home.yellows) + Number(stats.away.yellows)
      : null;
  const shotsTotal =
    stats.home.shots != null && stats.away.shots != null
      ? Number(stats.home.shots) + Number(stats.away.shots)
      : null;
  const shotsOnTargetTotal =
    stats.home.shotsOnTarget != null && stats.away.shotsOnTarget != null
      ? Number(stats.home.shotsOnTarget) + Number(stats.away.shotsOnTarget)
      : null;
  const extras = { cornersTotal, yellowsTotal, shotsTotal, shotsOnTargetTotal };
  const label = row.tip_label;
  if (!tipExtrasReady(label, extras)) {
    console.warn(`match ${row.id}: extras still incomplete for ${label}`, extras);
    continue;
  }
  const hit = evaluateSuggestedBet(label, row.home_goals, row.away_goals, extras);
  const outcome = hit == null ? 'void' : hit ? 'hit' : 'miss';
  d1Json(`
    UPDATE tip_results
    SET home_goals = ${sqlNum(row.home_goals)},
        away_goals = ${sqlNum(row.away_goals)},
        outcome = ${sqlStr(outcome)},
        settled_at = datetime('now')
    WHERE match_id = ${sqlNum(row.id)}
      AND outcome = 'pending'
      AND suggested_bet = ${sqlStr(label)}
  `);
  settled.push({
    matchId: row.id,
    fixture: `${row.home_name}–${row.away_name}`,
    tip: label,
    outcome,
    extras,
  });
  console.log(
    `OK ${row.id} ${row.home_name}–${row.away_name} ${label} → ${outcome}`,
    extras
  );
}

console.log(JSON.stringify({ date: dateArg, updated, settled }, null, 2));
