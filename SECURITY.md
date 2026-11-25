# Seguridad y datos sensibles

## Alcance

Este documento describe prácticas de mantenimiento y límites observados; no certifica la seguridad del producto. La revisión documental no realizó pruebas de intrusión ni operaciones privilegiadas sobre usuarios reales.

## Configuración

Mantener `.env`, `.dev.vars`, tokens de proveedor, secretos OAuth/Stripe y claves de operación fuera de Git. Usar valores independientes por entorno y configurar explícitamente los secretos necesarios antes de producción.

Los identificadores de recursos Cloudflare no sustituyen credenciales. Aun así, seleccionar y verificar cuenta, base y proyecto antes de cualquier comando remoto. No compartir la base de este producto con otros proyectos por comodidad.

No publicar el destino privado de soporte, enlaces de acceso interno, códigos de administración, exportaciones de cuenta ni registros con datos de sesión.

## Sesiones y autorizaciones

El servicio de cuentas usa derivación PBKDF2-SHA-256 mediante Web Crypto y sesiones opacas. Las cookies se configuran con `HttpOnly`, `Secure` y `SameSite=Lax`; OAuth utiliza un estado firmado. Los parámetros y costes criptográficos deben revisarse como parte de una evaluación de seguridad, no inferirse seguros por la mera existencia de estas técnicas.

Algunos límites de intentos y cachés son por isolate. No deben describirse como un control global distribuido. El consentimiento y los bloqueos de contenido visibles del frontend tampoco sustituyen la comprobación de autorización de cada ruta HTTP.

La activación de Premium depende de la lógica persistida y del webhook validado. Las operaciones de cuenta y suscripción deben probarse con usuarios aislados y en el modo de pruebas correspondiente.

## Privacidad

Perfiles, teléfonos, correos, sesiones, IP y tickets pueden contener datos personales. Restringir su acceso, revisar retención y evitar copiarlos a issues o capturas. La documentación pública debe usar ejemplos sintéticos y no contener valores reales.

No se declara cifrado de extremo a extremo ni una auditoría externa. El comportamiento real debe contrastarse con las políticas y configuración del despliegue.

## Comunicar una vulnerabilidad

No publicar secretos o datos personales en un issue. Utilizar un contacto privado con el responsable o el mecanismo de reporte privado de GitHub si está habilitado. No se presenta ese mecanismo como configurado sin verificarlo.

Ante una exposición, revocar o rotar primero en el proveedor, revisar accesos y actualizar el entorno. Quitar una credencial del último archivo no la elimina del historial de Git.
