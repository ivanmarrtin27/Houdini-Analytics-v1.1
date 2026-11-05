# Memory — Houdini Bet

## Decisiones
- Live stuck scheduled: status monotonicity + Slavia/Betis/Dortmund aliases + FD name-match repair + overdue 72h; tip primary P≥78; scorers multi-gol 1 línea + divider simétrico.
- tipMarketProb on today/panel; Top10 fill via raw P; Stats logos + `/stats/teams`; public brand Houdini Analytics; Aciertos→Partidos analyze.
- **Baseline:** restored to HoudiniBet-v1.0 (`1a8cf9b`) + Analytics logos/icons; free censor → `#premium` (`hbCensorWrap` + `data-hb-censor`); panel **sin** tip banner (probs sí); Top 10 intacto; Aciertos tab reserved; tips ricos solo admin; shell `hb139`.
- Match chrome: Analytics list/hero (compact rows, form pills, scorers); league logos (`leagueLogo` + AF CDN fallback); jornada from FD `RoundNumber`/`Group` (+ AF `league.round`); Top 10 sin cuotas (tip + %)
- CF Worker + D1; FD + FotMob + AF enrich
- Tips: anti-trivial (no O0.5 / U4.5); **nunca SHOTS_***; lane **P≥78%** + cuota≥1.25; **solo playable** en `tip_results`; display **P≥78%**; tipTier `none` → schema + `tip_tier`; BTTS secondary-only; secondary diversa
- UI: Partidos · Top 10 · Aciertos (`#aciertos`) · Stats por partido/día (`#stats`, `/stats/match-averages`) · Ligas; `#top3` / `#ligas/<apiId>` / `#premium` / `#perfil`; tip % = mercado raw truncado
- Auth bloqueante tras consent (sin sesión no hay app); cookie `hb_auth`; register/login/Google; Telegram UI **Pronto**
- Free vs Premium: winProb/live probs/tabs = Premium; **General key cards free**; H2H + tabla liga + chrome OK; censor/corona tap → `#premium`; Aciertos tip pill → `#premium`
- Nav: PNG `icons/ui/` (partidos/top10/aciertos/goals/ligas + crown); PWA iconos simples desde logo; mobile `.app-tabbar`; SW `hb139`; weekly API sin UI
- General key cards: o25/o15 SVG; goals/btts/cards PNG; corners SVG flag; wordmark in panel VS; Tiros ≠ SOT; i18n ES↔EN P0+P1
- Top 10 = solo primary (`suggestedBet`) tip+% (sin cuota); panel análisis = probs/chrome sin bloque tip; trend summary total centrado
- URL producto día a día: `houdini-analytics.pages.dev` (workers.dev = origen técnico)
- SOT Overs 0.5–11.5; córners 1.5–11.5; totalShots display degraded si n<4; FotMob stats prioriza equipos ventana
- Premium tabs Oddster-style (rojo): summary + trend Metric|H|A|Partido; free = `lockedTrendTableHtml`; goles + scoregrid debajo
- Promo (0036+0037): types `free_days`|`free_month`|`discount_20`|`discount_40`; soft-delete `active=0`; discount → `users.pending_promo_*` + Stripe `%_off` en checkout; admin create/list/delete
- Badge unificado `.plan-badge` «Premium»/«Gratuito»; settings sin tema (dark forzado); `#ajustes` ✕ → `#partidos`
- Planes UI: Weekly 9,99 € / Monthly 19,90 € → Stripe o toast «Pago no configurado»
- Display ES: `countryLabel` + `leagueLabelEs`; Panel General Media liga n≥20
- Crests: FotMob PSG/Elche/Deportivo/Leverkusen/Schalke/Racing/Paris FC + BL; AF broken list
- Dominio: **pages.dev** día a día; **no** pagar `houdini-bet.dev` hasta producto listo
- Consent v2 hard gate; Cooperación → GitHub ivanmarrtin27
- Market tabs: misma L H/A/Match; Over+Under; goles 0.5–3.5; BTTS bloque Sí(+No sutil); SOT 0.5–11.5; córners 1.5–11.5; tarjetas 0.5–5.5; Tiros 14.5–24.5; General 6 cards; Poisson cliente si ladder falta
- Panel % count-up: `data-target` pills + scoregrid + `animatePercents` (ease-out ~560ms; skip blur/reduced-motion)

## Hecho
- Onboarding: consent → auth gate → app; logout/delete → re-gate
- Premium tables + promo + badge + dark-only + `#premium` compact
- `#premium` / `#perfil` / settings / menú cuenta; admin hits/stats/users/promo + Activar/Quitar Premium
- Auth v1 + Google; Ligas explorer; live cron; tip lock; ban SHOTS_*
- Free General key cards + icons; tabs Tiros; i18n P0+P1; SOT/córners ranges; promo types+delete; admin Stats cards homogéneas; tip sync Top10=panel; Under tables + BTTS block; Tiros 14.5–24.5
- Full restore to v1.0 + Analytics brand/UI icons; Aciertos + free censor chrome from Analytics
- Match list/hero Analytics polish + competition logos + jornada (`0039_match_round`); Top 10 without odds; Stats día (altos/bajos, 5 métricas); Ligas búsqueda+logos; panel sin tip; censor→Premium; shell `hb139`
- Admin home: Stats tips preview (`/tips/performance`) + Códigos promo CRUD (parity Analytics); cache `adm4`; Pages `houdini-bet-admin` (+ also pushed to `houdini-analytics-admin`)

## Pendiente
- **API_FOOTBALL_KEY** válida (book real)
- Stripe webhook + suscripciones reales; email verify / reset password
- Google OAuth secrets/redirect si faltan; self-host fonts
- Stats público `#stats` se retirará cuando admin Stats esté consolidado
- Dominio custom `houdini-bet.dev` más adelante

## Deploy
- App Pages: `npx wrangler pages deploy pages --project-name houdini-analytics --branch main`
- Worker: `cd cloudflare; npx wrangler deploy`
- Migrate: `npx wrangler d1 migrations apply houdini-bet-db --remote`
- Admin: `npx wrangler pages deploy admin-pages --project-name houdini-bet-admin --branch main`
