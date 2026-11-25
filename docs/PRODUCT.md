# Producto y experiencia de uso

Houdini Analytics organiza el análisis de fútbol en cinco áreas principales. Las capturas del [README](../README.md) muestran versiones del producto; las funciones dependen de los datos y de las integraciones del entorno.

## Acceso y preferencias

La interfaz presenta primero consentimiento y confirmación de edad, y después el acceso a la cuenta. El registro por contraseña solicita identificador de usuario, nombre, correo, teléfono, contraseña y confirmación. El acceso admite identificador o correo. Google depende de su configuración OAuth.

La interfaz incluye textos en español e inglés y mantiene una identidad visual oscura. La navegación móvil se realiza mediante la barra inferior y pulsaciones; el producto no cambia de sección con gestos laterales entre pestañas.

## Partidos

Elegir el día y filtrar por estado. La lista agrupa encuentros por competición; el panel muestra equipos, horario o resultado, forma y análisis. La sincronización trabaja con una ventana de hoy y los catorce días siguientes, mientras las vistas del día usan la fecha seleccionada.

La cobertura se limita a las competiciones admitidas en `leagueAllowlist.js`: ligas domésticas seleccionadas y ciertas competiciones internacionales. Una ausencia puede deberse a cobertura, calendario o datos todavía no sincronizados.

## Panel de análisis

Las secciones agrupan información general, goles, tiros, tiros a puerta, córners y tarjetas. Las probabilidades y medias proceden de modelos y muestras disponibles. Alineaciones y datos complementarios pueden llegar después del contenido principal.

Las medias de partido del modelo y las medias históricas de liga representan magnitudes distintas. Ver [modelo](MODEL.md) para interpretar `homeXg`, `awayXg` y mercados de conteo. La interfaz puede limitar contenido según el plan; no se debe deducir la autorización de una API únicamente por el bloqueo visual.

## Top 10

La selección pertenece al día elegido. Se admiten hasta diez partidos con un mercado principal permitido y una probabilidad que entra en la banda de selección del modelo. Si hay menos candidatos válidos, la lista puede tener menos de diez.

La clasificación usa probabilidad estimada y reglas de universo/diversidad; las cuotas no determinan el orden de los tips principales. Las etiquetas heredadas o mercados excluidos no deben confundirse con el universo vigente.

## Aciertos

El tablero diario sigue los candidatos con estados `hit`, `miss`, `void` y `pending`. Un mercado de estadísticas puede permanecer pendiente hasta recibir los datos necesarios, aunque el partido haya finalizado. Aplazamientos y cancelaciones requieren tratamiento específico.

La experiencia pública de este tablero no presenta cuotas ni yield como parte de sus filas. La existencia de rutas históricas de rendimiento en el backend no cambia ese diseño de interfaz.

## Estadísticas y ligas

Estadísticas permite consultar medias por fecha, métrica y orden. Las métricas incluyen goles, tiros, tiros a puerta, córners y tarjetas. La cobertura y los tamaños muestrales condicionan su interpretación.

Ligas ofrece búsqueda, catálogo, clasificación y navegación a equipos o próximos partidos. Un torneo sin clasificación compatible puede mostrar un estado vacío; no debe sustituirse por una tabla inventada.

## Cuenta, Premium y soporte

Perfil incluye cambio de contraseña para cuentas compatibles, exportación y eliminación de cuenta. Los planes y promociones están implementados alrededor de sesiones Premium y Stripe; su disponibilidad depende de precios, secretos, webhook y migraciones.

Las solicitudes de contacto se guardan en D1. La notificación por correo depende de su proveedor y configuración; un ticket guardado y un correo entregado son resultados distintos.

## Instalación y límites

El repositorio contiene manifest y service worker para la experiencia PWA. La consulta de datos actualizados sigue dependiendo de la API y de las fuentes externas. No se ofrece una promesa de acceso offline completo, actualización instantánea ni predicciones garantizadas.

La revisión de esta documentación no ejecutó compras, creó cuentas reales ni verificó instalación en dispositivos físicos. Consultar [calidad](QUALITY.md).
