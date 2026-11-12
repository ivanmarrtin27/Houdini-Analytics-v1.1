# Stripe setup — Houdini Analytics Premium

Checkout usa **`mode: subscription`** (Mensual / Trimestral / Anual).  
No pongas secretos en git: solo `wrangler secret put` (o Dashboard → Workers → Settings → Variables).

## Precios de producto (deben coincidir con la UI)

| Plan UI (`plan`) | Cobro | Env Price ID |
|---|---|---|
| `monthly` | **7,99 €/mes** (flat, sin intro) | `STRIPE_PRICE_ID_MONTHLY` |
| `quarterly` | **19,99 € / 3 meses** (~6,66 €/mes; vs 3×7,99 = 23,97) | `STRIPE_PRICE_ID_QUARTERLY` |
| `annual` | **69,99 € / año** (~5,83 €/mes; vs 12×7,99 = 95,88) | `STRIPE_PRICE_ID_ANNUAL` |

## 1. Crear producto y precios (Test mode primero)

1. Stripe Dashboard → **Test mode** ON.
2. **Productos** → Crear producto `Houdini Analytics Premium`.
3. Añadir **3 precios recurrentes** (EUR):

### Mensual

- Recurrente: **7,99 €** cada **mes** → `STRIPE_PRICE_ID_MONTHLY`.
- Sin precio introductorio ni cupón de primer mes.

> `STRIPE_COUPON_FIRST_MONTH` ya no se usa con este pricing (opcional/legacy; no hace falta crearlo).

### Trimestral

- Recurrente: **19,99 €** cada **3 meses** → `STRIPE_PRICE_ID_QUARTERLY`.

### Anual

- Recurrente: **69,99 €** cada **año** → `STRIPE_PRICE_ID_ANNUAL`.

## 2. Webhook

Endpoint Worker:

```text
https://houdini-bet.ivanmarrtin2703.workers.dev/api/v1/premium/webhook
```

(Cuando el dominio custom esté listo, añade también la URL pública equivalente.)

Eventos a escuchar:

- `checkout.session.completed`
- `invoice.paid` (renovaciones)
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`

Copia el **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.

## 3. Secrets en Cloudflare (Phase 2)

Desde `cloudflare/`:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
# sk_test_… (pruebas) o sk_live_… (producción)

npx wrangler secret put STRIPE_WEBHOOK_SECRET
# whsec_…

npx wrangler secret put STRIPE_PRICE_ID_MONTHLY
npx wrangler secret put STRIPE_PRICE_ID_QUARTERLY
npx wrangler secret put STRIPE_PRICE_ID_ANNUAL
```

Legacy opcionales (no necesarios si ya tienes los tres Price ID):  
`STRIPE_PRICE_ID`, `STRIPE_PRICE_ID_WEEKLY`, `PREMIUM_DAYS`.  
`STRIPE_COUPON_FIRST_MONTH` no se aplica con el pricing flat 7,99 €.

## 4. Migración D1

```bash
npx wrangler d1 migrations apply houdini-bet-db --remote
```

Incluye `0041_stripe_subscription.sql` (`stripe_subscription_id` para sync de renovaciones/cancelación).

## 5. Cupones Houdini (`discount_20` / `discount_40`)

Al iniciar Checkout (subscription), el Worker aplica `discounts[0][coupon]` — nunca cambia `price`/`unit_amount` a mano.

Resolución del cupón Stripe:
1. Opcional: `STRIPE_COUPON_DISCOUNT_20` / `STRIPE_COUPON_DISCOUNT_40` (precreados en Dashboard)
2. Si no: cupón idempotente `houdini_pct_20_once` / `houdini_pct_40_once` (`percent_off` + `duration=once`)

`discount_40` sobre **7,99 €** → primer mes **4,79 €** (no 2,99: eso era la UI vieja con intro 4,99).  
Los `free_days` / `free_month` no pasan por Stripe (grant directo en app).

## 6. Test → Live

1. Completa el flujo en **Test** (tarjeta `4242…`).
2. Repite productos/precios/webhook en **Live mode**.
3. Sustituye secrets `sk_live_…` / `whsec_…` / `price_…` live.
4. Deploy Worker (+ Pages si cambió UI) y smoke: botones Mensual/Trimestral/Anual → Checkout → webhook → Premium activo.

## Checklist rápido

- [ ] 3 Prices recurrentes EUR (mensual **7,99** flat · trimestral **19,99** · anual **69,99**)
- [ ] Webhook URL + eventos + `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_SECRET_KEY` + 3 `STRIPE_PRICE_ID_*`
- [ ] Migración `0041` aplicada
- [ ] Test checkout + renovación/cancelación razonables
- [ ] (Luego) Live secrets + deploy
