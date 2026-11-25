# Pruebas y estado de verificación

Revisión documental del **25 de noviembre de 2026**, sobre código de referencia `8e6afcf`. Entorno: Node.js 22.22.2 en Windows. Los cambios de esta revisión afectan a Markdown; no reparan ni alteran el motor, las pruebas o el despliegue.

## Evidencia recogida

| Comprobación                      | Resultado                                                                   |
| --------------------------------- | --------------------------------------------------------------------------- |
| Aplicación pública                | HTTP 200, contenido HTML                                                    |
| `/health`                         | HTTP 200, runtime Workers                                                   |
| `/api/v1/status`                  | HTTP 200; modo live y datos de FixtureDownload                              |
| API-Football en el estado público | Autenticación rechazada; enriquecimiento pendiente de revisar configuración |
| Sintaxis JavaScript               | 76 archivos comprobados con `node --check`, sin errores                     |
| Scripts declarados por `npm test` | 20 en total; 11 pasan y 9 fallan al ejecutarlos individualmente             |
| Ejecución agregada `npm test`     | Se detiene en el segundo script, `test-live-ui.mjs`                         |

La accesibilidad de la aplicación y los endpoints no certifica todas sus integraciones. No se ejecutaron cobros, registro de cuentas, exportación de datos personales, operaciones de administración ni migraciones remotas.

## Reproducir

Desde `cloudflare/`:

```sh
npm ci
npm test

# Ejecutar un script concreto sin quedar bloqueado por otro anterior.
node scripts/test-live-model.mjs
node scripts/test-live-ui.mjs
```

El comando `npm test` contiene veinte invocaciones Node enlazadas con `&&`: un fallo impide ejecutar las siguientes. Para conocer el estado completo de esta revisión se ejecutaron también las veinte por separado, sin modificar sus aserciones.

## Inventario de la suite declarada

| Script                         | Resultado observado                                                  |
| ------------------------------ | -------------------------------------------------------------------- |
| `test-live-model.mjs`          | Pasa; 41 comprobaciones del modelo en vivo                           |
| `test-live-ui.mjs`             | Falla: `SyntaxError` en la extracción de helpers para `new Function` |
| `test-live-cron.mjs`           | Pasa                                                                 |
| `test-live-name-match.mjs`     | Pasa                                                                 |
| `test-market-panels.mjs`       | Falla: `getUiLang` no definido en el contexto de prueba              |
| `test-display-models.mjs`      | Pasa                                                                 |
| `test-pick-bets.mjs`           | Pasa                                                                 |
| `test-daily-tip-context.mjs`   | Pasa                                                                 |
| `test-daily-tip-diversity.mjs` | Pasa                                                                 |
| `test-top3-diversity.mjs`      | Falla: aserción de día seleccionado y helper no definido             |
| `test-swipe-guard.mjs`         | Falla: aserciones de gestos y overscroll                             |
| `test-mobile-ui.mjs`           | Falla: aserciones de estructura, tamaño y foco                       |
| `test-af-free-budget.mjs`      | Pasa                                                                 |
| `test-api-football-odds.mjs`   | Pasa                                                                 |
| `test-roi.mjs`                 | Falla: aserción de ROI por familia en la vista                       |
| `test-analysis-context.mjs`    | Falla: aserción de contexto de torneos/tabla                         |
| `test-ligas-explorer.mjs`      | Pasa                                                                 |
| `test-live-red-cards.mjs`      | Pasa                                                                 |
| `test-premium.mjs`             | Falla: aserciones de gating y estado de la UI                        |
| `test-pwa.mjs`                 | Falla: aserción de registro del service worker                       |

Varias pruebas extraen funciones o buscan fragmentos de texto en HTML/JS/CSS. Sus fallos deben investigarse para distinguir expectativas desactualizadas de regresiones reales. No equivalen automáticamente a errores de sintaxis de la aplicación: el análisis completo de sintaxis sí pasó.

El directorio contiene más scripts que los veinte declarados. Su presencia no implica que se ejecuten con `npm test` ni que se hayan validado en esta revisión. Los scripts de reparación y verificación remota requieren revisar sus efectos antes de ejecutarlos.

## CI existente

El workflow versionado escucha pushes y pull requests dirigidos a `main`, utiliza Node.js 22, ejecuta la suite y revisa sintaxis. La rama predeterminada actual es `analytics-hb139`; por tanto, ese workflow no ofrece automáticamente cobertura a todo cambio de la rama predeterminada.

Esta revisión no cambia el workflow ni añade un badge de CI en verde. Una futura actualización debería acordar ramas, casos relevantes y reparación de la suite antes de presentar el pipeline como condición de entrega.

## Verificaciones pendientes

- Clasificar y reparar los nueve scripts fallidos, conservando reglas vigentes del producto.
- Ampliar pruebas de navegador reales para consentimiento, cuenta, móvil y navegación.
- Verificar instalación y actualización PWA en dispositivos físicos.
- Verificar OAuth, notificaciones y Stripe con credenciales del entorno y cuentas de prueba.
- Revisar API-Football y cobertura real de enriquecimiento.
- Evaluar modelo y calibración con período, muestra y política de selección explícitos.
- Revisar autorización por ruta y controles de producción mediante una evaluación de seguridad separada.

Las capturas de [`docs/screenshots/`](screenshots/) son materiales existentes del proyecto. Ilustran la interfaz, pero no sustituyen evidencia de la versión actualmente desplegada.
