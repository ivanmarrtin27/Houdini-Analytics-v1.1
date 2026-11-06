<p align="center">
  <img src="cloudflare/public/brand/houdini-analytics-icon.png" alt="Houdini Analytics" width="160" />
</p>

<h1 align="center">Houdini Analytics v1.1</h1>

<p align="center">
  <strong>Predicciones de fútbol con modelo Poisson</strong> (shrinkage + Dixon–Coles) · Worker + D1 en Cloudflare · PWA estática
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
  <a href="#desarrollo">Desarrollo local</a>
  ·
  <a href="#api-resumen">API</a>
</p>

---

## Enlaces

| | URL |
|---|---|
| **App (día a día)** | https://houdini-analytics.pages.dev |
| **Worker / API** | https://houdini-bet.ivanmarrtin2703.workers.dev |
| **Repo** | https://github.com/ivanmarrtin27/Houdini-Analytics-v1.1 |
| **Health** | `/health` |
| **REST** | `/api/v1/...` |

Dominio custom `houdini-bet.dev` — previsto cuando auth y Premium pago estén listos para producción.

## Características

- **Partidos** — ventana hoy + 14 días; ligas top europeas, Segunda y competiciones UEFA; live con refresco y proyección en tiempo real
- **Mercados** — 1X2 · doble oportunidad / DNB · over/under · BTTS · córners, tarjetas y tiros a puerta (sin mercados `SHOTS_*`)
- **Top 10 del día** — tip primary con P **78–95%** (desc), cuota máx. 3.50, diversidad por familia; sin backfill low-P
- **Aciertos** — mismo universo Top del día (`/tips/day-results`) con ✓/✗/pendiente (sin cuotas/yield en UI)
- **Stats** — medias por partido/día (`/stats/match-averages`)
- **Ligas** — explorador por país, clasificación y próximo partido del equipo
- **Auth / Premium** — registro, login y Google OAuth; free censor hacia `#premium` (pago Stripe pendiente de lanzamiento formal)
- **UI** — PWA móvil (isotipo Analytics, tabbar tap-only, panel de análisis)
- **Datos** — sync programado (FixtureDownload + FotMob; enriquecimiento opcional vía API-Football)

## Aviso

Los pronósticos y tips son **informativos y orientativos**. No constituyen asesoramiento financiero ni garantizan resultados. Juega con responsabilidad y dentro de tus límites.

## Stack

| Pieza | Detalle |
|-------|---------|
| Runtime | Cloudflare Worker `houdini-bet` |
| Base de datos | D1 `houdini-bet-db` |
| Frontend | `cloudflare/public` — HTML, CSS, JS (sin framework) |
| Cron | sync `0 6 * * *` · enrich `30 6 * * *` (con clave API) |
| Ligas allowlist | `LEAGUE_IDS=140,141,39,135,78,61,5,2,3` |

Código de producción: [`cloudflare/`](./cloudflare). Backend Express + MySQL archivado en [`legacy/`](./legacy/).

## Estructura del proyecto

```
Houdini-Analytics-v1.1/
├── cloudflare/          # Worker, D1, UI estática, scripts de test
│   ├── public/          # PWA (app.js, styles, brand, icons)
│   ├── pages/           # alias deploy Pages (sync desde public)
│   ├── src/             # index.js, servicios, modelo live
│   └── migrations/      # esquema D1
├── legacy/              # CLI / backend local (referencia)
├── AGENTS.md            # guía para agentes de código
└── Memory.md            # notas internas del proyecto
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

**Deploy Worker:**

```bash
cd cloudflare
npm run deploy
# alias Pages (proxy estático):
npx wrangler pages deploy pages --project-name houdini-analytics --branch main
```

**Migraciones remotas:**

```bash
npx wrangler d1 migrations apply houdini-bet-db --remote
```

**Secrets (Wrangler):** `SYNC_SECRET` (sync manual); opcional `API_FOOTBALL_KEY` (cuotas/stats); auth `AUTH_SECRET` + Google.

**Tests:**

```bash
cd cloudflare && npm test
```

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

## CLI opcional (legacy)

```bash
cd legacy/backend
# API_BASE_URL=https://houdini-analytics.pages.dev
npm install && npm run cli
```

Sin `API_BASE_URL` apunta a MySQL local (solo desarrollo legacy).

## Roadmap

1. Stripe real (weekly/monthly) + webhook en dominio custom
2. Auth OAuth redirects al dominio de producto
3. Dominio custom opcional (`houdini-bet.dev`)

## Autor

[Iván Martín Molina](https://ivanmartin.pages.dev/) · [@ivanmarrtin27](https://github.com/ivanmarrtin27)

## Licencia

Uso personal / portfolio. No hay licencia open-source publicada por el momento.
