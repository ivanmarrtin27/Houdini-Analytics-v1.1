# Autenticación y cuentas

Guía del flujo implementado en `src/services/authService.js` y las rutas de `src/index.js`. Describe configuración; no confirma que OAuth o notificaciones estén operativos en un entorno concreto.

## Persistencia y secretos

Usuarios y sesiones se guardan en D1. Aplicar las migraciones del entorno según la guía de [operación](../../docs/OPERATIONS.md); el esquema de cuentas comienza en `0029` y se amplía en migraciones posteriores.

Definir fuera de Git:

| Nombre                 | Uso                                                             |
| ---------------------- | --------------------------------------------------------------- |
| `AUTH_SECRET`          | Firma de estado OAuth; configurar un secreto propio del entorno |
| `GOOGLE_CLIENT_ID`     | Cliente OAuth de Google                                         |
| `GOOGLE_CLIENT_SECRET` | Credencial privada del cliente                                  |
| `AUTH_PUBLIC_ORIGIN`   | Origen público utilizado para construir el retorno              |

Desde `cloudflare/`, los valores se introducen mediante el gestor de secretos del entorno, por ejemplo `npx wrangler secret put AUTH_SECRET`. No escribir valores en comandos publicados, capturas o documentación.

## Google OAuth

1. Preparar un proyecto y un cliente OAuth de aplicación web en Google Cloud.
2. Configurar el consentimiento y los usuarios permitidos según el estado del proyecto.
3. Elegir el origen público del entorno y fijarlo en `AUTH_PUBLIC_ORIGIN` cuando exista proxy.
4. Autorizar exactamente el callback que genera el código: `<origen-publico>/api/v1/auth/google/callback`.
5. Configurar las credenciales del cliente y comprobar inicio, retorno, cookie y salida con una cuenta de prueba.

Para la aplicación pública actual, el callback previsto es:

```text
https://houdini-analytics.pages.dev/api/v1/auth/google/callback
```

El código solicita `openid email profile`. No es necesario añadir permisos de otras API de Google para describir este flujo. Los entornos locales o personalizados necesitan su propia configuración de origen y retorno. [Referencia oficial de OpenID Connect de Google](https://developers.google.com/identity/openid-connect/openid-connect).

## Registro y sesión

- Registro: identificador `username`, nombre, correo, teléfono, contraseña y confirmación.
- Identificador: letras minúsculas, números y guion bajo, entre 3 y 20 caracteres.
- Acceso: `identifier` acepta identificador o correo; el backend conserva compatibilidad con el campo `email` anterior.
- La sesión se entrega mediante cookie opaca `hb_auth`; el servidor verifica su secreto persistido.
- Cambiar contraseña requiere la contraseña actual en las cuentas compatibles.

La interfaz presenta consentimiento y acceso antes del producto. Los permisos efectivos se revisan por ruta, no únicamente por la pantalla visible.

## Autoservicio

| Método | Ruta                           | Efecto                                          |
| ------ | ------------------------------ | ----------------------------------------------- |
| GET    | `/api/v1/auth/me`              | Cuenta de la sesión actual                      |
| POST   | `/api/v1/auth/logout`          | Revoca la sesión                                |
| POST   | `/api/v1/auth/change-password` | Cambia contraseña con verificación de la actual |
| GET    | `/api/v1/auth/export`          | Exporta perfil y referencias de cuenta          |
| POST   | `/api/v1/auth/delete`          | Elimina cuenta y trata referencias relacionadas |

Estas rutas no implementan recuperación de contraseña por correo. Las operaciones de cambio o eliminación deben verificarse únicamente con cuentas de prueba autorizadas.

## Notificación de soporte

Los tickets se guardan en D1. La entrega de un aviso se gestiona aparte y puede fallar aunque el ticket exista. La respuesta distingue `emailed`.

Configurar `SUPPORT_INBOX_EMAIL` como secreto privado. Para la vía Resend, configurar `RESEND_API_KEY` y un remitente autorizado mediante `SUPPORT_FROM_EMAIL` cuando corresponda. Respetar las restricciones del proveedor y del dominio del entorno. El código contempla un binding de correo alternativo si se configura expresamente.

No publicar el destinatario real ni asumir entrega de correo por el resultado del guardado del ticket.

## Verificación

Comprobar registro, acceso por identificador y correo, consulta de sesión, cierre, cambio de contraseña y exportación. Verificar Google por separado tras configurar callback. La prueba de eliminación usa una cuenta desechable y una comprobación de datos relacionados.

Las verificaciones locales conocidas y las pendientes están en [calidad](../../docs/QUALITY.md). La configuración de [Stripe](STRIPE_SETUP.md) es independiente del éxito del acceso.
