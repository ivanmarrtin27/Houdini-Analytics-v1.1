# Desarrollo local

## Rama y entorno

La versión descrita parte del código `8e6afcf` de la rama remota predeterminada `analytics-hb139`. `main` es otra base del repositorio. Los nombres de ramas locales pueden diferir de su rama de seguimiento; comprobar `git status -sb` antes de trabajar.

Requisitos: Git, Node.js 22 y npm. Wrangler es una dependencia de desarrollo de `cloudflare/package.json`. El frontend no requiere Angular, React ni una compilación de TypeScript.

```sh
git clone --branch analytics-hb139 https://github.com/ivanmarrtin27/Houdini-Analytics-v1.1.git
cd Houdini-Analytics-v1.1/cloudflare
npm ci
npm run db:local
npm run dev
```

Wrangler imprime el origen local, normalmente `http://localhost:8787`. Las migraciones locales preparan la base del emulador; no modifican D1 remoto. Algunas capacidades necesitan datos sincronizados y proveedores disponibles: no se debe confundir la ejecución local con una réplica de producción.

## Configuración por entorno

Usar `.dev.vars` local para secretos de desarrollo y las herramientas del proveedor para secretos desplegados. No copiar credenciales reales a Markdown, capturas o archivos versionados.

| Capacidad               | Configuración                                                 |
| ----------------------- | ------------------------------------------------------------- |
| Persistencia            | Binding `DB` y base configurada en `wrangler.jsonc`           |
| Recursos                | Binding `ASSETS` sobre `public/`                              |
| Cobertura               | Variable `LEAGUE_IDS`                                         |
| Operaciones protegidas  | `SYNC_SECRET`, definido explícitamente                        |
| Estado OAuth            | `AUTH_SECRET`, definido explícitamente                        |
| Google                  | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, origen de retorno |
| Enriquecimiento         | `API_FOOTBALL_KEY`, si se utiliza                             |
| Suscripciones           | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, IDs de precios  |
| Notificación de soporte | Secretos de destino, remitente y proveedor de correo          |

Los nombres de recursos del repositorio pertenecen al entorno del proyecto. Para un entorno propio, revisar bindings, IDs, origen del proxy y variables antes de cualquier operación remota. Mantener la base de este producto aislada de otros proyectos.

## Comandos existentes

Desde `cloudflare/`:

| Comando             | Efecto                                                             |
| ------------------- | ------------------------------------------------------------------ |
| `npm ci`            | Instala versiones del lockfile                                     |
| `npm run dev`       | Ejecuta Wrangler en desarrollo                                     |
| `npm run db:local`  | Aplica migraciones a la base local                                 |
| `npm test`          | Ejecuta veinte scripts secuenciales; se detiene en el primer fallo |
| `npm run deploy`    | Publica el Worker remoto; no es una comprobación local             |
| `npm run db:remote` | Modifica D1 remoto; requiere selección y revisión del entorno      |

No hay script `build`. Para validación de sintaxis se utiliza `node --check`, y para publicar Pages se usa el directorio `pages/`. Las operaciones remotas se explican en [operación](OPERATIONS.md).

## Trabajar con la interfaz

`public/` contiene las fuentes servidas por el Worker; `pages/` contiene el paquete servido por Pages. Conservar la correspondencia de los archivos que se quieran publicar y revisar sus diferencias deliberadamente. No copiar carpetas completas sin comprobar el proxy, caché, textos legales y recursos.

Mantener español e inglés, navegación por teclado, foco visible, contraste y adaptación móvil. Las etiquetas y colores deben representar estados reales. No convertir las probabilidades estimadas en afirmaciones de precisión verificada.

## Reglas de mantenimiento

- Conservar la separación entre motor, datos, proveedores e interfaz.
- Añadir una migración para cambios de esquema; no reescribir una ya aplicada.
- Añadir regresiones del modelo o integración cuando cambie una regla del producto.
- Revisar también `public/` y `pages/` si cambia contenido servido.
- Mantener los secretos y los borradores locales fuera de los commits.
- Documentar las verificaciones reales, incluidos fallos previos o pendientes.

## Legado

`legacy/backend/` conserva Express/MySQL y la CLI histórica. No es el backend de la aplicación pública actual. Su configuración y comandos no deben mezclarse con los de D1 y Workers; el proyecto CMD independiente tampoco forma parte de este entorno de ejecución.
