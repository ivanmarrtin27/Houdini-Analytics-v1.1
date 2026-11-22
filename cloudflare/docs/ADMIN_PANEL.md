# Panel admin Houdini Analytics

## Microsite (canónico)

> **Deploy siempre a** Pages project **`houdini-analytics-admin`** → `https://houdini-analytics-admin.pages.dev`.  
> `houdini-bet-admin` es **legacy**: no usar día a día; last-resort opcional. No borrar el proyecto remoto salvo petición explícita.

1. Abre **`https://houdini-analytics-admin.pages.dev`** (proyecto Pages `houdini-analytics-admin`).
2. Introduce el **PIN** (= Worker `SYNC_SECRET`, hasta 128 caracteres), campo enmascarado (`type=password`). Se envía como header `x-sync-secret`; se guarda en `sessionStorage` solo para esa pestaña. Valor operativo actual (no en git): el PIN acordado en ops — actualizar solo con `wrangler secret put SYNC_SECRET`.
3. Tras validar: dashboard (**Uso de hoy** D1: visitas / sesiones / tickets + Tips preview + Stats teaser + hits + cupones + **soporte** + cuentas). `#tips` = tip performance; `#stats` = Stats públicos; `#hits` = historial visitas.
4. UI: DocuForge layout, fondo negro `#0a0a0a`, primary rojo `#DC2626`. Branding **Houdini Analytics**. Código: [`cloudflare/admin-pages/`](../admin-pages/).
5. API base: `https://houdini-bet.ivanmarrtin2703.workers.dev`.
6. QR privado: carpeta local [`admin-qr/`](../../admin-qr/) (`mi-qr.html` + PNG). Apunta al microsite **sin** embeber el secret. Está en `.gitignore`.
7. **Tips vs Stats:** pestaña **Tips** (`#tips`) = rendimiento de tips (`GET /api/v1/tips/performance`: aciertos/fallos/pending + lista). Pestaña **Stats** (`#stats`) = UI pública de medias de partidos (`stats-public.js`). Separadas a propósito.
8. **Cupones Premium:** el panel crea códigos (`discount_20` | `discount_40` | `free_days` | `free_month`). El usuario los aplica en la app en **Premium → Aplicar cupón** (`POST /api/v1/premium/promo`). Descuentos se usan al pagar; `free_*` activan Premium al canjear (login obligatorio).

Cambiar acceso admin (solo Wrangler; **nunca** en git):

```bash
cd cloudflare
npx wrangler secret put SYNC_SECRET
```

Deploy (canónico):

```bash
cd cloudflare
npx wrangler pages deploy admin-pages --project-name houdini-analytics-admin --branch main
```

Legacy (no día a día): `--project-name houdini-bet-admin` → `https://houdini-bet-admin.pages.dev`.

## Acceso legacy (app principal)

1. `https://houdini-analytics.pages.dev/?admin=1#admin` (o workers.dev / `houdini-bet.pages.dev` legacy).
2. La UI pide `SYNC_SECRET` una vez por pestaña (`sessionStorage`).

Sin `?admin=1`, la vista `#admin` no se muestra ni se enruta.

## APIs

### Públicas

- `POST /api/v1/telemetry/hit` — body `{ path, referrer? }`; el Worker guarda IP (`CF-Connecting-IP`), país, UA truncado, host. Dedup 60s por `(ip, path)`. Retención 30 días.

### Admin (`x-sync-secret`)

- `GET /api/v1/admin/usage/today` — métricas **D1** hoy UTC: `hitsToday`, `uniqueIpsToday`, `loginsToday`, `ticketsToday` (`source: "d1"`)
- `GET /api/v1/admin/usage/daily?from=&to=` — serie diaria Worker (CF GraphQL; opcional / legacy)
- `GET /api/v1/admin/usage/visits?day=` — Web Analytics agregadas (legacy; UI dashboard ya no las usa)
- `GET /api/v1/admin/visits/recent?limit=` — hits D1 + `uniqueIpsToday` + `hitsToday` + `device`. `limit` máx. **500**. Preview UI = 5; `#hits` = historial
- `GET /api/v1/admin/support/tickets?limit=` — tickets del formulario `#contacto` (D1 `support_tickets`)
- `GET /api/v1/admin/users` — listado (sin password_hash)
- `POST /api/v1/admin/users/:id/revoke` — `disabled=1` + revoca sesiones
- `POST /api/v1/admin/users/:id/enable` — reactiva
- `DELETE /api/v1/admin/users/:id` — hard delete user + sessions

### Definición de métricas (tarjetas «Uso de hoy»)

| Métrica | Qué cuenta | Nota |
|---------|------------|------|
| Visitas hoy | Filas `page_hits` hoy UTC (+ IP únicas en meta) | Beacon app → D1; no CF Web Analytics |
| Sesiones hoy | Filas `auth_sessions` creadas hoy UTC | Login password / Google |
| Tickets soporte hoy | Filas `support_tickets` creadas hoy UTC | Formulario `#contacto` |
| Hits con IP (lista) | Mismo `page_hits` | Path + IP + país + UA; retención 30d |

## Privacidad (checklist)

Los hits con IP son datos personales. Antes de producto público / dominio custom:

1. Actualizar política de privacidad (qué se guarda, cuánto tiempo, para qué).
2. Base legal / interés legítimo o consentimiento según tu jurisdicción.
3. Acceso al log solo vía panel admin (secret).
4. Retención automática 30 días (`page_hits`).

## Dominio custom (fase posterior)

Cuando actives `houdini-bet.dev`:

1. El beacon de visitas ya usa la API del Worker → D1 `page_hits`.
2. Revisar política de privacidad / retención si el dominio custom amplía audiencia.

## Migración

```bash
npx wrangler d1 migrations apply houdini-bet-db --remote
```

Incluye `0031_users_disabled.sql` y `0032_page_hits.sql`.
