# TikTok content — Fase 1 (estático)

Pipeline local de **imágenes verticales 1080×1920** para Houdini Analytics.
No publica en TikTok. No usa n8n (eso es Fase 2+).

## Qué hay aquí

| Ruta | Uso |
|------|-----|
| `templates/cover.html` | Portada (logo + ANALISIS / ESTADISTICAS / fecha / DESLIZA) |
| `templates/tip-card.html` | Slide tip (equipos, mercado, % modelo, disclaimer) |
| `sample-input.json` | JSON de ejemplo (fecha + tips) |
| `caption-example.es.txt` | Caption + hashtags seguros (tono analytics, ES) |
| `assets/houdini-analytics-icon.png` | Isotipo de marca |
| `out/` | PNGs generados (gitignore parcial: se versiona un sample) |
| `../../scripts/tiktok/render.mjs` | Renderer JSON → PNG vía Chrome headless |

Estética: negro / rojo / blanco, logo Houdini, shards diagonales. Motivos suavizados hacia **barras + curvas + círculo tipo pitch** (menos velas de trading).

## Generar localmente

Requisitos: Node 18+, Chrome o Edge instalado.

Desde `cloudflare/`:

```bash
node scripts/tiktok/render.mjs
```

Opciones:

```bash
node scripts/tiktok/render.mjs --input content/tiktok/sample-input.json --out content/tiktok/out
node scripts/tiktok/render.mjs --chrome "C:/Program Files/Google/Chrome/Application/chrome.exe"
```

Salida típica:

- `out/cover-YYYYMMDD.png`
- `out/tip-YYYYMMDD-1.png` (+ más tips si el JSON trae varios)

Variables opcionales: `CHROME_PATH` o `PUPPETEER_EXECUTABLE_PATH`.

## Formato JSON

```json
{
  "date": "2026-11-18",
  "dateDisplay": "18/11/2026",
  "cover": {
    "eyebrow": "ANALISIS DE DATOS",
    "title": "ESTADISTICAS",
    "cta": "DESLIZA PARA VER"
  },
  "tips": [
    {
      "home": "Real Madrid",
      "away": "Sevilla",
      "league": "LaLiga",
      "marketCode": "OVER_25",
      "marketLabel": "Más de 2,5 goles",
      "probPct": 84
    }
  ],
  "meta": {
    "tag": "Tip del día",
    "handle": "houdini.analytics",
    "disclaimer": "Modelo estadístico (Poisson). Contenido informativo · no es consejo financiero ni de juego."
  }
}
```

Lenguaje: evitar *apuesta / cuota / bankroll*. Usar *señal del modelo*, *probabilidad estimada*, *análisis*.

## n8n (más adelante)

Fase 1 = plantillas + render local. Un flujo n8n futuro podría:

1. Leer tips del día (API / JSON export)
2. Llamar este script o un Worker de render
3. Dejar PNGs en carpeta / Drive para publicación **manual**

No configurar n8n ni auto-post en esta fase.
