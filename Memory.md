# Memory — Houdini Bet

## Decisiones
- Live stuck scheduled: status monotonicity + UEL aliases + FD/FotMob overdue repair; **postponed/cancelled** from FotMob PP/CANC (null scores; Aciertos void; sticky vs FD scheduled); FotMob extras enrich uses `fotmob_match_id` + `includeAll` (SOT/corners); **Aciertos** prop tips enrich on-read + settle → hit/miss; day-results must keep `matches.id` (not `predictions.id`); tip primary allowlist P 78–95; scorers multi-gol 1 línea.
- tipMarketProb on today/panel; Top10 fill via raw P; Stats logos + `/stats/teams`; public brand Houdini Analytics; Aciertos→Partidos analyze.
- **Baseline:** free censor → `#premium`; panel sin tip; tip universe = O1.5/O2.5 (+team) · BTTS Yes · DC 1X/X2 · cards O3.5 · corners O7.5 · SOT O7.5; Top 10 / Aciertos = **P 78–95%** desc + tip/% **sin cuota** (no odds gates; no low-P backfill; includeFinished día = Aciertos); Aciertos = **Top del día** (`GET /tips/day-results`, ✓/✗/pendiente, **sin cuotas/yield**; fill all qualifying ≤10); header = isotipo `icon` transparente; splash/PWA = isotipo `icon`; panel mark transparente; Segunda FotMob; lista sin jornada; pills >80/60–80/50–59/<50; Stats matchAvg = xG/expected panel; metrics PNG + «Tiros a puerta»; panel XI FotMob + tabla full; Ligas/search nextMatch por liga; Premium stage brand-first + i18n P0/P1 ES↔EN; shell `hb168`. Top10/Aciertos **re-pick** allowlisted tip from model probs on read (ignore stale `suggested_bet`).
- Match chrome: Analytics list/hero (compact rows, form pills, scorers); league logos (`leagueLogo` + AF CDN fallback); jornada from FD `RoundNumber`/`Group` (+ AF `league.round`); Top 10 tip + % (sin cuota)
- CF Worker + D1; FD + FotMob + AF enrich
- Tips (`tipMarkets.js`): anti-trivial (no O0.5 / U4.5); **nunca SHOTS_***; rank **P only**; lane **P 78–95%**; **solo playable** en `tip_results`; **BTTS_YES primary OK**; tipTier `none` → schema + `tip_tier`
- UI: Partidos · Top 10 · Aciertos Top del día (`#aciertos`, `/tips/day-results`) · Stats por partido/día (`#stats`, `/stats/match-averages`) · Ligas; `#top3` / `#ligas/<apiId>` / `#premium` / `#perfil`; tip % = mercado raw truncado; tab enter `view-enter` all 5 tabs (desktop nav + mobile tabbar); fixed `.v2-header` + `--v2-header-h` offset; shell `hb168`; postponed/cancelled i18n ES/EN
- Auth bloqueante tras consent (sin sesión no hay app); cookie `hb_auth`; register/login/Google; Telegram UI **Pronto**
- Free vs Premium: winProb/live probs/tabs = Premium; **General key cards free**; H2H + tabla liga + chrome OK; censor/corona tap → `#premium`
- Nav: PNG `icons/ui/`; PWA desde `houdini-analytics-icon`; mobile `.app-tabbar` (tap only — no finger swipe between tabs); SW `hb168`; weekly API sin UI; admin `repair-fotmob-extras` + stuck refresh voids postponed
- General key cards: over-goals (O1.5+O2.5) + avg-goals/corners/cards PNG; BTTS intacto; mark panel; Tiros ≠ SOT; i18n ES↔EN
- Top 10 = allowlisted primary tip+% (sin cuota) · P 78–95% desc; panel probs/chrome; mid scheduled = hora kickoff; trend summary centrado
- URL producto día a día: `houdini-analytics.pages.dev` (workers.dev = origen técnico)
- SOT Overs 0.5–11.5; córners 1.5–11.5; totalShots display degraded si n<4; FotMob stats prioriza equipos ventana
- Premium tabs Oddster-style (rojo): summary + trend Metric|H|A|Partido; free = `lockedTrendTableHtml`; goles + scoregrid debajo
- Promo (0036+0037): types `free_days`|`free_month`|`discount_20`|`discount_40`; soft-delete `active=0`; discount → `users.pending_promo_*` + Stripe `%_off` en checkout; admin create/list/delete
- Badge unificado `.plan-badge` «Premium»/«Gratuito»; settings sin tema (dark forzado); `#ajustes` ✕ → `#partidos`
- Planes UI: Mensual **7,99 €/mes** flat / Trimestral 19,99 / Anual 69,99 → Stripe Checkout **subscription** (`STRIPE_PRICE_ID_{MONTHLY,QUARTERLY,ANNUAL}`); sin intro 4,99; docs `cloudflare/docs/STRIPE_SETUP.md`
- Display ES: `countryLabel` + `leagueLabelEs`; Panel General Media liga n≥20
- Crests: contain + caja fija, sin `border-radius: 50%` en lista; móvil ~1.6rem / panel ~2.9rem; FotMob PSG/Elche/Deportivo/Leverkusen/Schalke/Racing/Paris FC + BL; AF broken list
- Dominio: **pages.dev** día a día; **no** pagar `houdini-bet.dev` hasta producto listo
- Consent v2 hard gate; Cooperación → GitHub ivanmarrtin27
- Market tabs: misma L H/A/Match; Over+Under; goles 0.5–3.5; BTTS bloque Sí(+No sutil); SOT 0.5–11.5; córners 1.5–11.5; tarjetas 0.5–5.5; Tiros 14.5–24.5; General 6 cards; Poisson cliente si ladder falta
- Panel % count-up: `data-target` pills + scoregrid + `animatePercents` (ease-out ~560ms; skip blur/reduced-motion)
- Perf: panel probs first + async lineups (FotMob 5m); Stats match-averages batched+45s; list GETs skip off-best repredict (re-pick on read); today/pred/table mem TTL; Top10 reuses Partidos cache; shell `hb168`

## Hecho
- Onboarding: consent → auth gate → app; logout/delete → re-gate
- Premium tables + promo + badge + dark-only + `#premium` compact
- `#premium` / `#perfil` / settings / menú cuenta; admin hits/stats/users/promo + Activar/Quitar Premium
- Auth v1 + Google; Ligas explorer; live cron; tip lock; ban SHOTS_*
- Free General key cards + icons; tabs Tiros; i18n P0+P1; SOT/córners ranges; promo types+delete; admin Stats cards homogéneas; tip sync Top10=panel; Under tables + BTTS block; Tiros 14.5–24.5
- Full restore to v1.0 + Analytics brand/UI icons; Aciertos + free censor chrome from Analytics
- Match list/hero + logos; tip universe P-only (no cuota) + Top 10/Aciertos fill ≤10; Stats layout+model + Ligas chrome; General icons; Aciertos Top del día (`/tips/day-results`, sin cuotas, fill ≤10); splash `#000` + OG framed; Segunda FotMob; escudos homogéneos; Premium UX + i18n; mobile header row ~52px homogéneo; header icon transparente; shell `hb164`; repo GitHub `Houdini-Analytics-v1.1`
- Admin: Tips `#tips` (`/tips/performance`) separado de Stats públicos `#stats`; Cupones Premium CRUD; cache `adm11`; Pages canónico `houdini-analytics-admin` (`houdini-bet-admin` = legacy)

## Pendiente
### Lanzamiento público / dominio
- Aciertos v2: rachas / calibración / ledger personal (out of day-board v1)
- Stripe Phase 2: secrets + webhook + migrate `0041` + deploy/test (código Phase 1 listo)
- Auth en dominio custom + Google OAuth redirects
- DNS Pages + cookies/success_url Stripe al dominio
- API_FOOTBALL_KEY válida
- Pase ES/EN móvil; PWA/splash coherente; legales al día

## Deploy
- App Pages: `npx wrangler pages deploy pages --project-name houdini-analytics --branch main`
- Worker: `cd cloudflare; npx wrangler deploy`
- Migrate: `npx wrangler d1 migrations apply houdini-bet-db --remote`
- Admin: `npx wrangler pages deploy admin-pages --project-name houdini-analytics-admin --branch main` (legacy: `houdini-bet-admin`)
