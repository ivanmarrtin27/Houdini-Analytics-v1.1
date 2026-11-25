# Suscripciones Premium con Stripe

El flujo implementado utiliza Checkout con `mode: subscription`, referencias de sesión Premium y sincronización mediante webhook. La presencia del código no certifica que precios, credenciales o cobros reales estén configurados.

## Planes e identidades

La interfaz del código revisado el 25 de noviembre de 2026 contiene estas referencias. Verificar que producto, moneda, periodicidad y precio reales del entorno coinciden antes de habilitar cobros.

| Clave       | Referencia de la UI       | Variable de precio          |
| ----------- | ------------------------- | --------------------------- |
| `monthly`   | 7,99 EUR cada mes         | `STRIPE_PRICE_ID_MONTHLY`   |
| `quarterly` | 19,99 EUR cada tres meses | `STRIPE_PRICE_ID_QUARTERLY` |
| `annual`    | 69,99 EUR cada año        | `STRIPE_PRICE_ID_ANNUAL`    |

Los importes son configuración de este producto, no una garantía de su disponibilidad actual. El código conserva compatibilidad con variables anteriores; para una configuración nueva utilizar los tres IDs dedicados y revisar los fallbacks del servicio.

## Preparar el entorno de prueba

1. Preparar producto y tres precios recurrentes en el modo de pruebas de Stripe.
2. Guardar la clave de prueba y los IDs correspondientes fuera de Git.
3. Configurar el endpoint del webhook del entorno y su secreto de firma.
4. Aplicar las migraciones pendientes; `0041_stripe_subscription.sql` añade la referencia de suscripción.
5. Comprobar la URL de éxito/cancelación para que vuelva al origen público correcto.

| Secreto o variable          | Finalidad                                             |
| --------------------------- | ----------------------------------------------------- |
| `STRIPE_SECRET_KEY`         | Acceso de servidor a Stripe                           |
| `STRIPE_WEBHOOK_SECRET`     | Validar firma del evento recibido                     |
| `STRIPE_PRICE_ID_MONTHLY`   | Precio mensual                                        |
| `STRIPE_PRICE_ID_QUARTERLY` | Precio trimestral                                     |
| `STRIPE_PRICE_ID_ANNUAL`    | Precio anual                                          |
| `AUTH_PUBLIC_ORIGIN`        | Origen público de referencia cuando existe proxy      |
| `PREMIUM_SUCCESS_URL`       | Retorno explícito opcional, si el entorno lo necesita |

Utilizar `wrangler secret put` o el gestor del entorno sin incluir valores en documentación. Las claves, precios y secretos de modo test y live son diferentes.

## Rutas y webhook

La aplicación inicia la operación mediante `POST /api/v1/premium/session`. La respuesta puede incluir `stripeConfigured`, `checkoutUrl` y detalles de error. Una URL creada o una página de retorno no demuestran por sí solas que el acceso esté activado.

Configurar un endpoint que llegue al Worker:

```text
<origen-del-entorno>/api/v1/premium/webhook
```

El código verifica la firma sobre el cuerpo recibido y procesa, entre otros, `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted` y `charge.refunded`. Revisar `premiumService.js` al cambiar el contrato o versión de eventos.

Stripe recomienda resolver el cumplimiento mediante eventos de servidor, y su documentación explica el diagnóstico de firmas y entregas: [Checkout](https://docs.stripe.com/checkout/fulfillment), [gestión de webhooks](https://docs.stripe.com/events/manage-webhook-endpoints).

## Promociones

Los descuentos porcentuales utilizan cupones Stripe aplicados al checkout. El flujo del producto los configura para un cobro (`duration: once`); no reducen automáticamente todas las renovaciones. Los códigos de días o mes gratuito se aplican como concesión en la aplicación.

Revisar creación, consumo y limpieza de promociones en el servicio antes de alterar reglas. Si un descuento solicitado no puede aplicarse, el flujo debe explicar el fallo en lugar de cobrar silenciosamente otra condición.

## Aceptación

- Comprobar cada plan y su retorno al origen correcto.
- Verificar firma válida y rechazo de eventos inválidos.
- Confirmar persistencia de sesión, usuario, suscripción y vigencia.
- Comprobar renovación, cancelación y reembolso en el modo de pruebas.
- Comprobar descuento inicial y renovación a la condición prevista.
- Separar explícitamente la configuración live y repetir las comprobaciones acordadas antes de habilitarla.

Esta revisión documental no realizó compras ni operaciones de Stripe. Ver [operación](../../docs/OPERATIONS.md) y [calidad](../../docs/QUALITY.md).
