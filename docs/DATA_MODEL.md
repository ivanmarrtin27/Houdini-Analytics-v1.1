# Datos y persistencia

El esquema se define mediante migraciones en [`cloudflare/migrations/`](../cloudflare/migrations/). La capa de acceso es [`src/db.js`](../cloudflare/src/db.js). D1 utiliza un esquema independiente del backend MySQL legado.

## Entidades de dominio

| Área                    | Tablas principales                     | Responsabilidad                                            |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------- |
| Competiciones           | `leagues`                              | Nombre, país, logo e identidad del proveedor               |
| Equipos                 | `teams`                                | Identidad, competición y recursos visuales                 |
| Calendario y resultados | `matches`                              | Equipos, fecha, estado, marcador e IDs externos            |
| Historial               | `team_stats`                           | Métricas por equipo/partido y condición de local           |
| Predicciones            | `predictions`                          | Probabilidades, expectativas, tip y referencias de cálculo |
| Cuotas                  | `odds`                                 | Precios observados, fuente y momento de actualización      |
| Seguimiento             | `tip_results`, `combo_results`         | Estado y liquidación de selecciones                        |
| Cuenta                  | `users`, `auth_sessions`               | Perfil, proveedor de acceso y sesiones                     |
| Premium                 | `premium_sessions`                     | Vinculación de usuario, vigencia y suscripción             |
| Promociones             | `promo_codes`, `promo_redemptions`     | Definición y consumo de códigos                            |
| Operación               | `meta`, `page_hits`, `support_tickets` | Estado, actividad y solicitudes de soporte                 |

La tabla es un mapa funcional, no una reproducción completa del esquema. Consultar las migraciones y consultas antes de modificar columnas o relaciones.

## Identidades

Los IDs internos de D1 y los de proveedores son conceptos distintos. El código conserva referencias como `api_id`, `af_fixture_id` y `fotmob_match_id`. Los feeds sintéticos utilizan espacios de identidad propios para evitar colisiones.

No unir registros de fuentes distintas únicamente por el nombre visible. La lógica de normalización y coincidencia debe considerar equipos, competición, fecha y referencias existentes.

## Fechas y estados

Los endpoints por día usan fechas `YYYY-MM-DD`; varios defaults se obtienen de `toISOString()`, por lo que su día por defecto es UTC. La presentación local de un horario no cambia automáticamente el criterio de agrupación de la API.

Los estados del partido, el marcador, el minuto y los eventos deben ser coherentes. Aplazado y cancelado no equivalen a un resultado final 0–0. Una estadística ausente tampoco equivale a cero.

Para selecciones se distinguen `hit`, `miss`, `void` y `pending`. La liquidación de un mercado de conteo necesita sus datos específicos y puede ocurrir después de que termine el partido.

## Predicción e historial

La tabla `predictions` mantiene probabilidades de varios mercados y campos derivados. Que una etiqueta histórica exista en un registro no significa que siga admitida para el tip público; el selector actual utiliza el universo y probabilidades vigentes.

Las referencias de cuotas incluyen fuente y fecha. Una probabilidad implícita o precio derivado del modelo no debe presentarse como una cuota observada de un operador. El tablero público de Aciertos mantiene su diseño sin cuotas/yield.

## Cuenta y privacidad

Las contraseñas se derivan con Web Crypto; las sesiones opacas usan secreto aleatorio y verificación persistida. Los perfiles, teléfonos, sesiones, IP y tickets son datos que requieren tratamiento restringido. Las exportaciones de cuenta y los informes de operación no deben adjuntarse a issues públicos.

Las migraciones posteriores incorporan username, deshabilitación, vinculación Premium, promociones, suscripciones y soporte. Borrar una cuenta debe seguir el servicio de aplicación para revocar sesiones y tratar las referencias relacionadas; no ejecutar un borrado SQL aislado como sustituto sin revisar sus efectos.

## Evolución del esquema

1. Crear una migración nueva en orden, sin modificar las ya aplicadas.
2. Revisar consultas de `db.js` y los servicios afectados.
3. Aplicar primero en un entorno local o separado.
4. Verificar datos ausentes, versiones anteriores y repetición de procesos.
5. Respaldar el entorno y coordinar la publicación antes de aplicar en remoto.

El repositorio incluye scripts operativos de reparación y backfill. Su presencia no autoriza ejecutarlos sobre producción; revisar entrada, alcance y efectos según [operación](OPERATIONS.md).
