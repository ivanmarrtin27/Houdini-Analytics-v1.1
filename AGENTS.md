# AGENTS.md — Houdini Analytics v1.1

## Qué es
App de predicciones de fútbol (Poisson). Producto: **Houdini Analytics v1.1**.

## Baseline
- Workspace restored to **HoudiniBet-v1.0** (`origin/main` @ `1a8cf9b`) + **only** Analytics brand logos (`cloudflare/public/brand/`) and UI icons (`cloudflare/public/icons/ui/`). Future feature work starts from this baseline; do not re-port post-v1.0 tip-band / Premium rewrite / Semanal purge logic unless asked.
- GitHub product repo: **`ivanmarrtin27/Houdini-Analytics-v1.1`** (renamed from `HoudiniBet-v1.0`).

## Runtime de producción (Cloudflare)
- URL día a día: **`https://houdini-analytics.pages.dev`** (Pages `houdini-analytics`); v1.0 docs also mention `houdini-bet.pages.dev`. Custom `houdini-bet.dev` opcional cuando producto listo (auth + Premium pago)
- Worker origen (API/deploy técnico, no día a día): `https://houdini-bet.ivanmarrtin2703.workers.dev`
- D1: `houdini-bet-db` (ID `b6ee98e6-2397-45e5-83cb-33d1370656ae`) — **aislado del proyecto QR**
- Cron sync: `0 6 * * *`
- Código: carpeta [`cloudflare/`](cloudflare/)
- Secrets: `SYNC_SECRET`, opcional `API_FOOTBALL_KEY`
- Vars: `LEAGUE_IDS=140,141,39,135,78,61,5,2,3` (top5 + Segunda + UNL + UCL + UEL)
- Sync sin key: FixtureDownload (domésticas + UNL + Champions + Europa) + FotMob Friendlies + **Segunda** (LaLiga2; jornada desde FotMob `round`/`roundName`); con `API_FOOTBALL_KEY`: odds/stats AF vía `POST /api/v1/sync/enrich` (cron `30 6 * * *`)
- Lista: ventana **hoy + 14 días**; solo ligas allowlist (sin ASEAN / AFC / CAF / CONCACAF NL / WCQ / etc.)
- Auto-sync si stale >12h
- En vivo: `POST /api/v1/matches/refresh-live` (cooldown 45 s) + `POST /api/v1/matches/:id/live`; proyección en `src/services/liveModel.js`

## Stack local (legacy / CLI)
- Express + MySQL en [`legacy/backend/`](legacy/backend/) (archivado)
- CLI: `API_BASE_URL` → usa API Cloudflare; sin URL → MySQL local

## UI
HTML/JS en `cloudflare/public` (mínima). Pulir con `frontend-design` / `web-design-guidelines` después. Angular descartado.
- Auth: D1 `users`/`auth_sessions`; cookie `hb_auth`; register (username+name+email+phone+password) / login (username|email) /me/logout + Google OAuth; post-register welcome 3s + Premium modal; secrets `AUTH_SECRET` + Google; Aciertos `#aciertos` = Top del día; Stats vía `#stats`
- Admin microsite (canónico): `https://houdini-analytics-admin.pages.dev` (Pages `houdini-analytics-admin`; [`cloudflare/admin-pages/`](cloudflare/admin-pages/); DocuForge dark+red; PIN=`SYNC_SECRET`); usage today + daily chart + Web Analytics + D1 `page_hits` (preview 5 + `#hits`); **Tips** `#tips` = tip performance (`/tips/performance`); **Stats** `#stats` = Stats públicos (`stats-public.js`); promo create/list/delete (tipos free_days|free_month|discount_20|40); users search + revoke/enable/delete; secrets `CF_ACCOUNT_ID`/`CF_API_TOKEN` (+ opc. `CF_WEB_ANALYTICS_SITE_TAG`); `houdini-bet-admin` = **legacy** (no usar día a día; opcional last-resort); dominio `houdini-bet.dev` later; ver `cloudflare/docs/ADMIN_PANEL.md`
- Consent v2 obligatorio: sin `houdini_consent_v1` (choice + ageConfirmed) la app pública queda bloqueada (shell oculto); legales leíbles dentro del gate
- Nav: desktop `.v2-nav` + PNG icons (`icons/ui/`); mobile bottom `.app-tabbar` (Partidos/Top 10/Aciertos/Stats/Ligas; tap only, no finger swipe between tabs); Premium chip uses `premium-crown.png`; brand `houdini-analytics-{mark,icon,lockup}`; header = **isotipo** `icon` transparente (sin tile `#000`); splash = **isotipo** `icon` (fondo `#000`); panel mid mark **transparente**; PWA desde isotipo; share/canonical `houdini-analytics.pages.dev`; OG = isotipo encuadrado; shell cache `hb167`; mobile `.v2-header` row ~52px homogéneo; panel XI FotMob + tabla completa; search/Ligas nextMatch scoped por liga; Premium stage Mensual-primary + i18n ES/EN P0; UI Aplazado/Cancelado
- Free censor: `hbCensorWrap` + `data-hb-censor` → `#premium`; Aciertos = **Top del día** (`GET /tips/day-results`; free summary + 3 tips; **sin cuotas/yield** in UI; fill all P 78–95% qualifying ≤10); tip % raw market; admin tips intactos
- Tab enter: Partidos / Top 10 / Stats use `view-enter` + row stagger (tap only; no finger swipe)
- Match chrome: `.league-match` + hero `.mp-teams`; panel mid scheduled = **hora** (no VS/NS); **panel sin tip banner**; logos; jornada en panel meta (`round_number` / `round_group`), **no** en lista Partidos; escudos contain sin crop circular (móvil mayores); splash pad `#000` (header icon sin tile)
- Prob pills/barras: &gt;80% verde · 60–80% ámbar · 50–59% gris · &lt;50% rojo soft (`hbPillTone` / `mp-stat__fill--*`)
- Stats: date-sort fecha|sort en todos los anchos; metrics PNG homogéneos (avg-/shots/sot); `matchAvg` = xG/expected panel (no raw histórico); sin `match-stats-row__samples`; Ligas detail head: chevron + logo + hairline
- Stats móvil: `.match-stats__metric` una línea homogénea (flex equal / snap)
- Ligas móvil: tabla slide-desde-derecha (mismo patrón que panel análisis); `#ligas/<apiId>` + atrás
- Partidos chrome: chips estado (Todos/En vivo/Finalizados/Próximos); **sin** scope Todas/clubs/intl (siempre all)
- Display ES: países/ligas vía `countryLabel` + `leagueLabelEs` (no inglés crudo en UI)
- **Ligas** (`#ligas`): buscador cliente país/liga + catálogo con logos; split (países | tabla) Europeas (2/3/5) + top5 → `GET /leagues/:apiId/table` → tap equipo → nextMatch; `#ligas/<apiId>`
- Live: name-match umbral 85; no pintar scores si kickoff futuro; postponed/cancelled (FotMob PP/CANC → void tips, null scores; sticky vs FD); FotMob extras enrich `fotmob_match_id`+`includeAll`; `POST /api/v1/admin/matches/repair-future-finished` · `repair-fotmob-extras`

## Mercados Houdini
- Tip universe (`tipMarkets.js`): **OVER_15** / **HOME|AWAY_OVER_15** · **OVER_25** / **HOME|AWAY_OVER_25** · **BTTS_YES** (primary OK) · **DC_1X|DC_X2** · **CARDS_OVER_35** · **CORNERS_OVER_75** · **SOT_OVER_75** — rank by **model P only** (no cuota/odds gates); playable / Top 10 / Aciertos band **P 78–95%** desc (no low-P backfill); anti-trivial / no SHOTS_*; diversity labels/familias; **solo tip primary**
- Top 10 (hash `#top3`): **día seleccionado**; fill `min(10, N)` from tip universe; tip label + % (**sin cuota UI**); tip_results / tip board ricos → **admin**; Aciertos = mismo universo + hit/miss/void/pending (`/tips/day-results`); prop tips (SOT/corners/cards) cierran tras extras FotMob (on-read enrich + settle; pending solo pre-FT o sin datos upstream)
- Panel General: O1.5 / O2.5 / BTTS + Media liga n≥20; **sin** tip/suggest
- Panel markets (analysis, not tip lane): 1X2 · DC/DNB · O/U 0.5–4.5 · BTTS · corners/cards/SOT · value ≥5% (book); **nunca SHOTS_*** tip
- Panel ladders: SOT 0.5–11.5; córners 1.5–11.5; tarjetas 0.5–5.5; Tiros 14.5–24.5; Over+Under; BTTS en Goles; General icons `over-goals`/`avg-*` PNG (BTTS intacto); shell `hb164`
- Tips: allowlist only; lane **P 78–95%**; solo playable en `tip_results`; **BTTS_YES primary OK**
- Stats primario = `/stats/match-averages` (métricas en una línea móvil); tip % = tipMarketProb raw
- Crests: FotMob PSG/Elche/Deportivo/Leverkusen/Schalke/Racing Santander/Paris FC + BL roster; audit `node scripts/audit-crests.mjs`
- Admin reset Stats: `POST /api/v1/admin/stats/reset` (wipe + `stats_reset_at`)

## Convenciones
- Nunca mezclar D1/DB con proyecto QR
- Memory ≤100 líneas (ideal ≤70)
- Secrets fuera del repo
- Deploy Worker: `cd cloudflare && npx wrangler deploy`
- Deploy alias Pages: `cd cloudflare && npx wrangler pages deploy pages --project-name houdini-analytics --branch main` (fallback `houdini-bet` if project missing)
- Deploy admin microsite: `cd cloudflare && npx wrangler pages deploy admin-pages --project-name houdini-analytics-admin --branch main` (canonical; `houdini-bet-admin` = legacy only)
