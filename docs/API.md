# Referencia de API

La interfaz utiliza rutas del mismo origen bajo `/api/v1`. Pages las reenvía al Worker. La fuente canónica es [`cloudflare/src/index.js`](../cloudflare/src/index.js).

Este documento resume las rutas usadas por el producto; no es una especificación exhaustiva ni una garantía de estabilidad externa. Los permisos deben comprobarse por endpoint. El bloqueo visual de una sección no demuestra que una ruta esté restringida por plan.

## Convenciones

- Respuestas JSON, salvo redirecciones y recursos estáticos.
- Fechas de consulta `YYYY-MM-DD`; los valores por defecto basados en ISO utilizan UTC.
- Sesión de cuenta mediante cookie del mismo origen; no colocar cookies ni tokens en URLs de ejemplo.
- Las lecturas pueden incluir cálculo o mantenimiento diferido, por lo que no todas son operaciones sin efectos sobre D1 o proveedores.
- Los errores habituales incluyen un campo `error` y estado HTTP adecuado a la ruta.

## Estado

| Método | Ruta             | Función                                            |
| ------ | ---------------- | -------------------------------------------------- |
| GET    | `/health`        | Salud básica del Worker                            |
| GET    | `/api/v1/status` | Modo, fuente, cobertura y marcas de sincronización |

Comprobación pública mínima:

```sh
curl https://houdini-analytics.pages.dev/health
curl https://houdini-analytics.pages.dev/api/v1/status
```

Una respuesta HTTP 200 de estado no verifica por sí sola todas las integraciones. Consultar los campos de autenticación, cobertura y última sincronización pertinentes.

## Partidos, resultados y estadísticas

| Método | Ruta                             | Parámetros o alcance                                                                       |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------ |
| GET    | `/api/v1/matches/today`          | Día/ventana y filtro `leagueId`                                                            |
| GET    | `/api/v1/matches/best-bets`      | Selecciones de la ventana; existen opciones de límites y cuotas para servicios específicos |
| GET    | `/api/v1/matches/:id/prediction` | Bundle del encuentro, usando su ID interno                                                 |
| GET    | `/api/v1/matches/:id/lineups`    | Alineaciones disponibles                                                                   |
| POST   | `/api/v1/matches/refresh-live`   | Refresco global condicionado y sujeto a cooldown                                           |
| POST   | `/api/v1/matches/:id/live`       | Refresco de un encuentro                                                                   |
| GET    | `/api/v1/tips/day-results`       | `date=YYYY-MM-DD`; tablero de resultados diarios                                           |
| GET    | `/api/v1/tips/summary`           | Resumen de resultados                                                                      |
| GET    | `/api/v1/stats/match-averages`   | `date`, `metric`, `sort` y `n`                                                             |
| GET    | `/api/v1/leagues`                | Catálogo de ligas                                                                          |
| GET    | `/api/v1/leagues/:apiId/table`   | Clasificación por identidad de competición del proveedor                                   |
| GET    | `/api/v1/teams/search`           | Búsqueda con `q`                                                                           |

En `stats/match-averages`, `metric` admite `goals`, `shots`, `sot`, `corners` o `cards`; `sort` admite `high` o `low`. La ruta valida el formato de fecha. La consulta de clasificación devuelve un motivo de vacío si todavía no hay datos compatibles.

El Top 10 de la interfaz no debe describirse como un simple reflejo de todas las filas de `best-bets`: aplica la selección pública por día y universo permitido.

## Identidad

| Método | Ruta                           | Contrato principal                                            |
| ------ | ------------------------------ | ------------------------------------------------------------- |
| POST   | `/api/v1/auth/register`        | `username`, `name`, `email`, `phone`, `password`, `password2` |
| POST   | `/api/v1/auth/login`           | `identifier` y contraseña; acepta identificador o correo      |
| GET    | `/api/v1/auth/me`              | Usuario actual o ausencia de sesión                           |
| POST   | `/api/v1/auth/logout`          | Revocación de la sesión                                       |
| GET    | `/api/v1/auth/google/start`    | Inicio OAuth si está configurado                              |
| GET    | `/api/v1/auth/google/callback` | Retorno OAuth                                                 |
| POST   | `/api/v1/auth/change-password` | `currentPassword`, `newPassword`, `newPassword2`              |
| GET    | `/api/v1/auth/export`          | Exportación de los datos de la cuenta                         |
| POST   | `/api/v1/auth/delete`          | Eliminación de la cuenta autenticada                          |

No ejecutar ejemplos de registro, cambio de contraseña o eliminación sobre una cuenta real durante una comprobación documental. Ver [configuración de Auth](../cloudflare/docs/AUTH_SETUP.md).

## Premium y soporte

| Método | Ruta                            | Función                                                       |
| ------ | ------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/v1/premium/status`        | Estado y configuración disponible                             |
| POST   | `/api/v1/premium/session`       | Sesión Premium y, cuando procede, URL de Stripe Checkout      |
| POST   | `/api/v1/premium/webhook`       | Recepción de eventos Stripe con firma verificada              |
| POST   | `/api/v1/premium/promo/preview` | Comprobación de promoción                                     |
| POST   | `/api/v1/premium/promo`         | Aplicación de promoción                                       |
| POST   | `/api/v1/support/tickets`       | Guardado de una solicitud; envío de aviso según configuración |

El código de checkout utiliza `/premium/session`; no se documenta una ruta `/premium/checkout` inexistente. Una respuesta de sesión puede incluir `stripeConfigured`, `checkoutUrl` o información de fallo sin que se haya completado un cobro.

## Operaciones privilegiadas

La sincronización manual, el enriquecimiento, reparaciones y administración requieren credenciales y revisión de efectos. No se publican aquí URLs de acceso al panel interno ni valores de secretos. La guía de [operación](OPERATIONS.md) diferencia lectura de diagnóstico y acciones que modifican estado.
