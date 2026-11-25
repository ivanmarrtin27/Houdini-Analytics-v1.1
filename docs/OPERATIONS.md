# Operación y despliegue

Esta guía describe el proceso del repositorio; no ejecuta despliegues ni modifica servicios. El origen público de uso es la aplicación de Pages. El Worker es el runtime de API; la administración se despliega separadamente y su acceso no se enlaza aquí.

## Entornos y configuración

Revisar cuenta Cloudflare, nombre del Worker, proyecto Pages, binding D1 y proxy antes de publicar. Los IDs del repositorio corresponden al entorno existente del producto y no deben copiarse a un entorno propio sin adaptarlos.

| Configuración        | Finalidad                                       |
| -------------------- | ----------------------------------------------- |
| `DB` / D1            | Persistencia aislada del producto               |
| `ASSETS`             | Recursos de la interfaz                         |
| `LEAGUE_IDS`         | Cobertura de sincronización                     |
| `SYNC_SECRET`        | Operaciones protegidas; definir explícitamente  |
| `AUTH_SECRET`        | Estado firmado de OAuth; definir explícitamente |
| Variables de Google  | Acceso OAuth y retorno al origen correcto       |
| Variables de Stripe  | Checkout, eventos y precios recurrentes         |
| `API_FOOTBALL_KEY`   | Enriquecimiento opcional                        |
| Variables de soporte | Destino y proveedor de notificaciones           |

Las credenciales se configuran fuera de Git. No imprimir valores ni pegarlos en tickets públicos. Las guías de [Auth](../cloudflare/docs/AUTH_SETUP.md) y [Stripe](../cloudflare/docs/STRIPE_SETUP.md) detallan sus requisitos.

## Diagnóstico de lectura

```sh
curl https://houdini-analytics.pages.dev/health
curl https://houdini-analytics.pages.dev/api/v1/status
```

Revisar fuente, modo, cobertura, autenticación de proveedor y últimas ejecuciones. Un HTTP 200 no demuestra que cuotas, OAuth, correo o suscripciones funcionen.

La revisión del 25 de noviembre de 2026 observó `mode: live`, datos de FixtureDownload y autenticación rechazada para API-Football. Ver [calidad](QUALITY.md). Si el enriquecimiento es necesario, revisar la credencial y el proveedor por los canales privados del entorno; no incluir el valor en la documentación.

Otras lecturas pueden activar trabajo diferido. No ejecutar sincronizaciones, reparaciones, cobros o borrados como si fueran comprobaciones de salud.

## Preparar una publicación

1. Trabajar desde la rama y revisión acordadas; comparar el estado local con el remoto.
2. Revisar diferencias en código, esquema, recursos públicos y paquete Pages.
3. Ejecutar la suite y los checks relevantes. Registrar fallos previos sin ocultarlos.
4. Revisar migraciones pendientes y preparar recuperación de datos antes de aplicarlas.
5. Verificar secretos, proveedores, callback OAuth y webhook en el entorno previsto.
6. Comprobar compatibilidad entre frontend, API y esquema si las publicaciones no son simultáneas.

`public/` y `pages/` no se sincronizan automáticamente. Preservar el `_worker.js` de Pages y revisar las diferencias de archivos equivalentes antes de publicar. No subir borradores de iconos, prototipos o recursos locales de preview por una copia masiva.

## Comandos remotos

Desde `cloudflare/`, y únicamente tras la revisión del entorno y del cambio:

```sh
# Modifica D1 remoto: revisar migraciones y copia de seguridad antes.
npx wrangler d1 migrations apply houdini-bet-db --remote

# Publica la API y los assets del Worker.
npx wrangler deploy

# Publica los archivos preparados en pages/.
npx wrangler pages deploy pages --project-name houdini-analytics --branch main
```

El `--branch main` del despliegue Pages es un parámetro del destino de Pages; la rama Git predeterminada del repositorio documentado sigue siendo `analytics-hb139`. No cambiar una por otra de forma implícita.

La publicación del panel interno requiere su proceso separado. No forma parte de una actualización del README ni debe activarse por cambios documentales.

## Cron y actualización de datos

Las expresiones vigentes se detallan en [arquitectura](ARCHITECTURE.md). Cloudflare ejecuta los cron en UTC; el horario local y la propagación de cambios deben considerarse al diagnosticar una ejecución. [Referencia oficial de Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

El enriquecimiento puede omitir trabajo si faltan credenciales o presupuesto. El directo consulta trabajo pendiente para evitar llamadas innecesarias. Un dato atrasado exige revisar proveedor, marcas de tiempo, colas y estado de partido, no repetir indiscriminadamente el refresco.

## Después de publicar

- Abrir la app y comprobar navegación, recursos e idioma en escritorio y móvil.
- Consultar salud, estado y datos representativos sin provocar operaciones privilegiadas.
- Verificar que fecha, marcador, minuto, aplazado/cancelado y datos ausentes se representan correctamente.
- Comprobar cuenta y OAuth en un usuario de prueba, si esas funciones cambiaron.
- Probar pagos solo en el entorno y modo de pruebas acordados; confirmar el estado persistido por webhook.
- Verificar caché, manifest y service worker; no asumir que todos los navegadores han recibido el mismo shell instantáneamente.

## Recuperación

Revertir archivos de frontend no revierte el esquema D1 ni un evento de facturación. Mantener migraciones compatibles y una estrategia de datos antes de modificar producción.

Si aparece una credencial en Git o registros, revocar o rotar en el proveedor, revisar accesos y actualizar el entorno. Borrarla del último commit no elimina su historial.

Los scripts de backfill, reparación, calibración y reinicio tienen efectos distintos. Revisar sus consultas y alcance antes de usarlos. No se han ejecutado sobre producción durante esta revisión documental.
