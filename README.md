<p align="center">
  <img src="cloudflare/public/brand/houdini-analytics-icon.png" alt="Houdini Analytics" width="160" />
</p>

<h1 align="center">Houdini Analytics v1.1</h1>

<p align="center">
  <strong>Predicciones de fútbol con modelo Poisson</strong> (shrinkage + Dixon–Coles) · Cloudflare Pages + Worker + D1 · PWA
</p>

<p align="center">
  <a href="https://houdini-analytics.pages.dev"><img src="https://img.shields.io/badge/demo-pages.dev-DC2626?style=for-the-badge" alt="Live demo"></a>
  <a href="./cloudflare"><img src="https://img.shields.io/badge/runtime-Workers%20%2B%20D1-0A0A0A?style=for-the-badge" alt="Stack"></a>
  <img src="https://img.shields.io/badge/version-v1.1-3B82F6?style=for-the-badge" alt="Version v1.1">
  <img src="https://img.shields.io/badge/status-MVP%20%2F%20beta-F59E0B?style=for-the-badge" alt="Status">
</p>

<p align="center">
  <a href="https://houdini-analytics.pages.dev">Abrir app</a>
  ·
  <a href="#desarrollo">Desarrollo</a>
  ·
  <a href="#deploy">Deploy</a>
  ·
  <a href="#api-resumen">API</a>
</p>

---

## Enlaces

| | URL |
|---|---|
| **App (día a día)** | https://houdini-analytics.pages.dev |
| **Admin (canónico)** | https://houdini-analytics-admin.pages.dev |
| **Worker / API** | https://houdini-bet.ivanmarrtin2703.workers.dev |
| **Repo** | https://github.com/ivanmarrtin27/Houdini-Analytics-v1.1 |
| **Health** | `/health` |
| **REST** | `/api/v1/...` |

Admin legacy `houdini-bet-admin.pages.dev` — no usar día a día. Docs: [`cloudflare/docs/ADMIN_PANEL.md`](./cloudflare/docs/ADMIN_PANEL.md).

Dominio custom `houdini-bet.dev` — opcional más adelante (auth + Premium en prod).

## Modelo (una línea)

Poisson por equipo (ataque/defensa con shrinkage) + ajuste Dixon–Coles → probabilidades de goles y mercados derivados; tips se rankean por **P del modelo** (banda playable **78–95%**).

## Características

- **Partidos** — ventana hoy + 14 días; top5 + Segunda + UNL/UCL/UEL; live (refresh + proyección)
- **Top 10** — tip primary allowlist, P **78–95%** desc (sin gate de cuotas en ranking; sin cuota en UI)
- **Aciertos** — Top del día (`/tips/day-results`): hit / miss / void / pending
- **Stats** — medias por partido/día (`/stats/match-averages`)
- **Ligas** — catálogo + tabla + próximo partido (`#ligas/<apiId>`)
- **Panel análisis** — 1X2, DC/DNB, O/U, BTTS, córners/tarjetas/SOT (sin tips `SHOTS_*`)
- **Auth** — registro / login / Google OAuth; cookie `hb_auth`; consent v2 obligatorio
- **Premium (Stripe)** — suscripciones **Mensual 7,99 €** · **Trimestral 19,99 €** · **Anual 69,99 €**; free censor → `#premium`; promos admin (`free_days` / `free_month` / `discount_20|40`)
- **Admin** — usage, Web Analytics, tips performance, Stats públicos, promos, usuarios (PIN = `SYNC_SECRET`)
- **Datos** — cron sync FixtureDownload + FotMob; enrich opcional API-Football

Setup Stripe (Test → Live): [`cloudflare/docs/STRIPE_SETUP.md`](./cloudflare/docs/STRIPE_SETUP.md). Auth: [`cloudflare/docs/AUTH_SETUP.md`](./cloudflare/docs/AUTH_SETUP.md).

## Aviso

Los pronósticos y tips son **informativos y orientativos**. No constituyen asesoramiento financiero ni garantizan resultados. Juega con responsabilidad.

## Stack

| Pieza | Detalle |
|-------|---------|
| Frontend | Cloudflare Pages `houdini-analytics` (`cloudflare/public` → deploy via `pages/`) |
| API | Worker `houdini-bet` |
| DB | D1 `houdini-bet-db` (aislado; no mezclar con otros proyectos) |
| Admin | Pages `houdini-analytics-admin` (`cloudflare/admin-pages/`) |
| Cron | sync `0 6 * * *` · enrich `30 6 * * *` (si hay `API_FOOTBALL_KEY`) |
| Ligas | `LEAGUE_IDS=140,141,39,135,78,61,5,2,3` |

Código de producción: [`cloudflare/`](./cloudflare). Express + MySQL archivado en [`legacy/`](./legacy/). (Histórico: producto renombrado desde HoudiniBet v1.0.)

## Estructura

```
Houdini-Analytics-v1.1/
├── cloudflare/
│   ├── public/          # PWA (fuente UI)
│   ├── pages/           # alias deploy Pages
│   ├── admin-pages/     # microsite admin
│   ├── src/             # Worker, servicios, liveModel
│   ├── migrations/      # D1
│   ├── docs/            # ADMIN_PANEL, AUTH_SETUP, STRIPE_SETUP
│   └── scripts/         # tests / utilidades
├── legacy/              # CLI / backend local (referencia)
├── AGENTS.md
└── Memory.md
```

## Desarrollo

Requisitos: Node.js LTS, cuenta Cloudflare, [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

```bash
cd cloudflare
npm install
npx wrangler d1 migrations apply houdini-bet-db --local
npm run dev
# o: npx wrangler dev
```

```bash
cd cloudflare && npm test
```

## Deploy

```bash
cd cloudflare
npx wrangler deploy
# App Pages:
npx wrangler pages deploy pages --project-name houdini-analytics --branch main
# Admin (canónico; no houdini-bet-admin):
npx wrangler pages deploy admin-pages --project-name houdini-analytics-admin --branch main
```

Migraciones remotas:

```bash
npx wrangler d1 migrations apply houdini-bet-db --remote
```

### Env / secrets (alto nivel)

Poner con `npx wrangler secret put …` (nunca en git):

| Secret / var | Uso |
|---|---|
| `SYNC_SECRET` | sync manual + PIN admin |
| `AUTH_SECRET` | sesiones |
| Google OAuth | login social |
| `API_FOOTBALL_KEY` | enrich odds/stats (opcional) |
| `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PRICE_ID_{MONTHLY,QUARTERLY,ANNUAL}` | Premium |
| `CF_ACCOUNT_ID` / `CF_API_TOKEN` | admin Web Analytics (opcional) |

Vars de producto: `LEAGUE_IDS=…`. Detalle Stripe: [`STRIPE_SETUP.md`](./cloudflare/docs/STRIPE_SETUP.md).

## API (resumen)

| Método | Ruta |
|--------|------|
| GET | `/api/v1/status` |
| GET | `/api/v1/matches/today?days=0\|14` |
| GET | `/api/v1/matches/best-bets` |
| GET | `/api/v1/tips/day-results` |
| GET | `/api/v1/stats/match-averages` |
| GET | `/api/v1/matches/:id/prediction` |
| GET | `/api/v1/leagues/:apiId/table` |
| POST | `/api/v1/sync/manual` (header `x-sync-secret`) |
| POST | `/api/v1/premium/checkout` · webhook Stripe |

## CLI opcional (legacy)

```bash
cd legacy/backend
# API_BASE_URL=https://houdini-analytics.pages.dev
npm install && npm run cli
```

Sin `API_BASE_URL` apunta a MySQL local (solo legacy).

## Roadmap

1. Dominio custom + OAuth redirects de producto
2. Stripe Live estable (tras validar Test)
3. Pulido UI (design guidelines)

## Autor

[Iván Martín Molina](https://ivanmartin.pages.dev/) · [@ivanmarrtin27](https://github.com/ivanmarrtin27)

## Licencia

Uso personal / portfolio. No hay licencia open-source publicada por el momento.
