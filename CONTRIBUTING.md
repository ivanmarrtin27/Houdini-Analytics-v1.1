# Contribuir a Houdini Analytics

## Preparación

Leer [desarrollo](docs/DEVELOPMENT.md), [arquitectura](docs/ARCHITECTURE.md) y el estado de [calidad](docs/QUALITY.md). Partir de la rama acordada: la predeterminada es `analytics-hb139`, mientras `main` conserva otra base.

Trabajar en una rama propia o un worktree cuando haya cambios locales ajenos a la tarea. No añadir previews, secretos, bases de datos, exportaciones ni recursos de operación privados a un commit general.

## Reglas del producto

- Conservar el universo canónico de tips y la distinción entre probabilidad estimada y rendimiento observado.
- No rellenar el Top 10 con candidatos que no cumplen las reglas solo para alcanzar diez filas.
- Mantener estados de datos ausentes, aplazados y cancelados.
- Revisar español, inglés, móvil y teclado en cambios de interfaz.
- Mantener separados los entornos D1 y el backend legado.
- Documentar configuración y migraciones sin publicar valores de credenciales ni acceso interno.

## Antes de proponer un cambio

1. Describir el problema, alcance y resultado esperado.
2. Revisar el diff y limitar archivos al cambio solicitado.
3. Ejecutar comprobaciones relevantes y distinguir fallos nuevos de los conocidos.
4. Añadir regresiones para cambios de modelo, selección, fechas o liquidación.
5. Revisar `public/` y `pages/` si se modifica contenido que se sirve por ambos caminos.
6. Actualizar documentación y migraciones cuando cambien contratos o entorno.

Un cambio documental no autoriza despliegues, sincronizaciones remotas, cobros ni administración de usuarios. Mantener esas operaciones separadas y revisables.

## Describir una propuesta

Explicar qué cambia para el usuario o mantenedor, cómo se verificó y qué queda pendiente. Incluir capturas sin datos personales cuando cambie la interfaz. No afirmar que toda la suite pasa si solo se ejecutaron scripts concretos.

Los problemas de seguridad se comunican según [seguridad](SECURITY.md), sin exponer información sensible en comentarios públicos.
