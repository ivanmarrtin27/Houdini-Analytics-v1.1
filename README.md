<p align="center">
  <img src="cloudflare/public/brand/houdini-analytics-icon.png" alt="Houdini Analytics" width="108" />
</p>

<h1 align="center">Houdini Analytics</h1>

<p align="center">
  <strong>Predicciones de fútbol con modelo Poisson</strong><br>
  <sub>Tip lane 78–95% · en vivo · PWA dark/red en Cloudflare</sub>
</p>

<p align="center">
  <a href="https://houdini-analytics.pages.dev"><img src="https://img.shields.io/badge/%E2%96%B6_Abrir_app_en_vivo-DC2626?style=for-the-badge&labelColor=0A0A0A" alt="Abrir app en vivo"></a>
  &nbsp;
  <a href="https://houdini-analytics-admin.pages.dev"><img src="https://img.shields.io/badge/Admin_panel-1A1A1A?style=for-the-badge&labelColor=0A0A0A" alt="Admin"></a>
</p>

<p align="center">
  <a href="https://houdini-analytics.pages.dev"><img src="https://img.shields.io/badge/Live-houdini--analytics.pages.dev-DC2626?style=flat-square&labelColor=0A0A0A" alt="Live"></a>
  <img src="https://img.shields.io/badge/Stack-Workers%20%2B%20D1%20%2B%20Pages-0A0A0A?style=flat-square&labelColor=1A1A1A" alt="Stack">
  <img src="https://img.shields.io/badge/v1.1-MVP-DC2626?style=flat-square&labelColor=0A0A0A" alt="v1.1">
  <img src="https://img.shields.io/badge/PWA-ready-1A1A1A?style=flat-square&labelColor=0A0A0A" alt="PWA">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Poisson-0A0A0A?style=flat-square&labelColor=1A1A1A" alt="Poisson">
  <img src="https://img.shields.io/badge/Tip_78%E2%80%9395%25-DC2626?style=flat-square&labelColor=0A0A0A" alt="Tip 78-95%">
  <img src="https://img.shields.io/badge/Top_10-0A0A0A?style=flat-square&labelColor=1A1A1A" alt="Top 10">
  <img src="https://img.shields.io/badge/Aciertos-0A0A0A?style=flat-square&labelColor=1A1A1A" alt="Aciertos">
  <img src="https://img.shields.io/badge/Stats-0A0A0A?style=flat-square&labelColor=1A1A1A" alt="Stats">
  <img src="https://img.shields.io/badge/Ligas-0A0A0A?style=flat-square&labelColor=1A1A1A" alt="Ligas">
  <img src="https://img.shields.io/badge/Premium-DC2626?style=flat-square&labelColor=0A0A0A" alt="Premium">
</p>

<p align="center">
  <a href="#producto">Producto</a>
  ·
  <a href="#stack">Stack</a>
  ·
  <a href="#desarrollo">Dev</a>
  ·
  <a href="#deploy">Deploy</a>
  ·
  <a href="#capturas">Capturas</a>
</p>

---

## Producto

App de predicciones (Poisson + Dixon–Coles). Tips rankeados solo por **P del modelo** (banda playable **78–95%**).

| | |
|---|---|
| **App** | [houdini-analytics.pages.dev](https://houdini-analytics.pages.dev) |
| **Admin** | [houdini-analytics-admin.pages.dev](https://houdini-analytics-admin.pages.dev) |
| **API** | `houdini-bet…workers.dev` → `/api/v1/…` · `/health` |

- **Partidos** — hoy + 14 días · top5 + Segunda + Championship + UNL/UCL/UEL · live
- **Top 10 / Aciertos** — tip primary allowlist · hit / miss / void / pending
- **Stats · Ligas · Panel** — medias, tablas, 1X2 / O-U / BTTS / córners / tarjetas / SOT
- **Auth · Premium** — cookie + Google · Stripe (Mensual / Trimestral / Anual)
- **Datos** — cron FixtureDownload + FotMob · enrich opcional API-Football

Docs: [Admin](./cloudflare/docs/ADMIN_PANEL.md) · [Auth](./cloudflare/docs/AUTH_SETUP.md) · [Stripe](./cloudflare/docs/STRIPE_SETUP.md)

> Pronósticos **informativos**. No son asesoramiento financiero. Juega con responsabilidad.

## Stack

| | |
|---|---|
| Frontend | Pages `houdini-analytics` (`cloudflare/public` → `pages/`) |
| API | Worker `houdini-bet` |
| DB | D1 `houdini-bet-db` (aislado) |
| Admin | Pages `houdini-analytics-admin` |
| Cron | sync `0 6 * * *` · enrich `30 6 * * *` |
| Ligas | `140,141,39,40,135,78,61,5,2,3` |

Producción en [`cloudflare/`](./cloudflare). Legacy Express/MySQL en [`legacy/`](./legacy/).

```
cloudflare/
├── public/          # PWA
├── pages/           # deploy Pages
├── admin-pages/     # admin
├── src/             # Worker + servicios
├── migrations/      # D1
├── docs/            # setup
└── scripts/
```

## Desarrollo

Node.js LTS + [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

```bash
cd cloudflare
npm install
npx wrangler d1 migrations apply houdini-bet-db --local
npm run dev          # o: npx wrangler dev
npm test
```

## Deploy

```bash
cd cloudflare
npx wrangler deploy
npx wrangler pages deploy pages --project-name houdini-analytics --branch main
npx wrangler pages deploy admin-pages --project-name houdini-analytics-admin --branch main
npx wrangler d1 migrations apply houdini-bet-db --remote
```

Secrets (`wrangler secret put`, nunca en git): `SYNC_SECRET`, `AUTH_SECRET`, Google OAuth, `STRIPE_*`, opcional `API_FOOTBALL_KEY` / `CF_*`.

### API (resumen)

| | Ruta |
|---|---|
| GET | `/api/v1/status` · `/matches/today` · `/matches/best-bets` |
| GET | `/tips/day-results` · `/stats/match-averages` · `/matches/:id/prediction` |
| GET | `/leagues/:apiId/table` |
| POST | `/sync/manual` · `/premium/checkout` (+ webhook Stripe) |

## Capturas

| Vista | | |
|-------|---|---|
| Partidos | <img src="docs/screenshots/partidos-desktop.png" alt="Partidos desktop" width="220" /> | Lista del día + panel de análisis |
| Ligas | <img src="docs/screenshots/ligas-desktop.png" alt="Ligas desktop" width="200" /> | Catálogo, logos y tablas |
| Móvil | <img src="docs/screenshots/partidos-mobile.jpg" alt="Partidos móvil" width="108" /> | Chips, escudos, tabbar |
| Análisis | <img src="docs/screenshots/analisis-general-mobile.jpg" alt="Análisis móvil" width="108" /> | O1.5 · O2.5 · BTTS · medias |

## Autor

[Iván Martín Molina](https://ivanmartin.pages.dev/) · [@ivanmarrtin27](https://github.com/ivanmarrtin27)

Uso personal / portfolio — sin licencia open-source por ahora.
