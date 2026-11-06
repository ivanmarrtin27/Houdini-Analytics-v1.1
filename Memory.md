# Memory — Houdini Bet

## Decisiones
- Live stuck scheduled: status monotonicity + UEL aliases (Sparta Praha/Prague, GNK Dinamo, Union SG, H. Beer-Sheva, N.E.C.) + apostrophe/initialism normalize + FD then FotMob overdue repair 72h; tip primary P≥78; scorers multi-gol 1 línea + divider simétrico.
- tipMarketProb on today/panel; Top10 fill via raw P; Stats logos + `/stats/teams`; public brand Houdini Analytics; Aciertos→Partidos analyze.
- **Baseline:** free censor → `#premium`; panel sin tip; Top 10 = P 78–95% desc + cuota shown (no low-P backfill); Aciertos = **Top del día** (`GET /tips/day-results`, ✓/✗/pendiente); header = isotipo `icon` transparente (sin tile `#000`); splash/PWA = isotipo `icon`; panel mark transparente; Segunda FotMob; lista sin jornada; pills >80/60–80/50–59/<50; Stats matchAvg = xG/expected panel; metrics PNG + «Tiros a puerta»; panel XI FotMob + tabla full; Ligas/search nextMatch por liga; Premium stage brand-first + i18n P0/P1 ES↔EN; shell `hb157`.
- Match chrome: Analytics list/hero (compact rows, form pills, scorers); league logos (`leagueLogo` + AF CDN fallback); jornada from FD `RoundNumber`/`Group` (+ AF `league.round`); Top 10 tip + % + cuota
- CF Worker + D1; FD + FotMob + AF enrich
- Tips: anti-trivial (no O0.5 / U4.5); **nunca SHOTS_***; lane **P≥78%** + cuota≥1.25; **solo playable** en `tip_results`; display **P≥78%**; tipTier `none` → schema + `tip_tier`; BTTS secondary-only; secondary diversa
- UI: Partidos · Top 10 · Aciertos Top del día (`#aciertos`, `/tips/day-results`) · Stats por partido/día (`#stats`, `/stats/match-averages`) · Ligas; `#top3` / `#ligas/<apiId>` / `#premium` / `#perfil`; tip % = mercado raw truncado
- Auth bloqueante tras consent (sin sesión no hay app); cookie `hb_auth`; register/login/Google; Telegram UI **Pronto**
- Free vs Premium: winProb/live probs/tabs = Premium; **General key cards free**; H2H + tabla liga + chrome OK; censor/corona tap → `#premium`
- Nav: PNG `icons/ui/`; PWA desde `houdini-analytics-icon`; mobile `.app-tabbar` (tap only — no finger swipe between tabs); SW `hb157`; weekly API sin UI
- General key cards: over-goals (O1.5+O2.5) + avg-goals/corners/cards PNG; BTTS intacto; mark panel; Tiros ≠ SOT; i18n ES↔EN
- Top 10 = primary tip+%+cuota · P 78–95% desc; panel probs/chrome; mid scheduled = hora kickoff; trend summary centrado
- URL producto día a día: `houdini-analytics.pages.dev` (workers.dev = origen técnico)
- SOT Overs 0.5–11.5; córners 1.5–11.5; totalShots display degraded si n<4; FotMob stats prioriza equipos ventana
- Premium tabs Oddster-style (rojo): summary + trend Metric|H|A|Partido; free = `lockedTrendTableHtml`; goles + scoregrid debajo
- Promo (0036+0037): types `free_days`|`free_month`|`discount_20`|`discount_40`; soft-delete `active=0`; discount → `users.pending_promo_*` + Stripe `%_off` en checkout; admin create/list/delete
- Badge unificado `.plan-badge` «Premium»/«Gratuito»; settings sin tema (dark forzado); `#ajustes` ✕ → `#partidos`
- Planes UI: Weekly 9,99 € / Monthly 19,90 € → Stripe o toast «Pago no configurado»
- Display ES: `countryLabel` + `leagueLabelEs`; Panel General Media liga n≥20
- Crests: contain + caja fija, sin `border-radius: 50%` en lista; móvil ~1.6rem / panel ~2.9rem; FotMob PSG/Elche/Deportivo/Leverkusen/Schalke/Racing/Paris FC + BL; AF broken list
- Dominio: **pages.dev** día a día; **no** pagar `houdini-bet.dev` hasta producto listo
- Consent v2 hard gate; Cooperación → GitHub ivanmarrtin27
- Market tabs: misma L H/A/Match; Over+Under; goles 0.5–3.5; BTTS bloque Sí(+No sutil); SOT 0.5–11.5; córners 1.5–11.5; tarjetas 0.5–5.5; Tiros 14.5–24.5; General 6 cards; Poisson cliente si ladder falta
- Panel % count-up: `data-target` pills + scoregrid + `animatePercents` (ease-out ~560ms; skip blur/reduced-motion)
- Perf: panel probs first + async `GET /matches/:id/lineups` (FotMob cache 5m); Stats `/match-averages` batched D1 + 45s TTL

## Hecho
- Onboarding: consent → auth gate → app; logout/delete → re-gate
- Premium tables + promo + badge + dark-only + `#premium` compact
- `#premium` / `#perfil` / settings / menú cuenta; admin hits/stats/users/promo + Activar/Quitar Premium
- Auth v1 + Google; Ligas explorer; live cron; tip lock; ban SHOTS_*
- Free General key cards + icons; tabs Tiros; i18n P0+P1; SOT/córners ranges; promo types+delete; admin Stats cards homogéneas; tip sync Top10=panel; Under tables + BTTS block; Tiros 14.5–24.5
- Full restore to v1.0 + Analytics brand/UI icons; Aciertos + free censor chrome from Analytics
- Match list/hero + logos; Top 10; Stats layout+model + Ligas chrome; General icons; Aciertos Top del día (`/tips/day-results`); splash `#000` + OG framed; Segunda FotMob; escudos homogéneos; Premium UX + i18n; mobile header row ~52px homogéneo; header icon transparente; shell `hb157`
- Admin home: Stats tips preview (`/tips/performance`) + Códigos promo CRUD (parity Analytics); cache `adm4`; Pages `houdini-bet-admin` (+ also pushed to `houdini-analytics-admin`)

## Pendiente
### Lanzamiento público / dominio
- Aciertos v2: rachas / calibración / ledger personal (out of day-board v1)
- Stripe real + webhook + price weekly/monthly
- Auth en dominio custom + Google OAuth redirects
- DNS Pages + cookies/success_url Stripe al dominio
- API_FOOTBALL_KEY válida
- Pase ES/EN móvil; PWA/splash coherente; legales al día

## Deploy
- App Pages: `npx wrangler pages deploy pages --project-name houdini-analytics --branch main`
- Worker: `cd cloudflare; npx wrangler deploy`
- Migrate: `npx wrangler d1 migrations apply houdini-bet-db --remote`
- Admin: `npx wrangler pages deploy admin-pages --project-name houdini-bet-admin --branch main`
