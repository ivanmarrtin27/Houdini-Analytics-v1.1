# Modelo probabilístico e interpretación

Esta guía describe el código de la versión revisada. No constituye una validación externa del modelo ni una promesa de precisión.

## Goles y distribución de marcadores

[`matchModel.js`](../cloudflare/src/services/matchModel.js) calcula probabilidades de Poisson:

```text
P(X = k) = exp(-lambda) * lambda^k / k!
```

Las intensidades local y visitante se estiman con ataque, defensa, muestras por condición de local/visitante y referencias de liga. El cálculo utiliza ponderación temporal y contracción hacia medias de liga para reducir la dependencia de muestras pequeñas.

Los valores por defecto incluyen decaimiento 0,85, un prior equivalente a ocho partidos y una intensidad mínima de 0,15 en la estimación base. Estos valores son parámetros del código, no intervalos de confianza.

La matriz de marcadores aplica el ajuste Dixon–Coles a resultados bajos. El flujo de predicción construye una matriz de 0 a 8 goles por equipo con `rho = -0.08` y la renormaliza. Sumar celdas permite obtener 1X2, dobles oportunidades, mercados de goles y ambos marcan.

`homeXg` y `awayXg` representan expectativas de goles del modelo. Su interpretación no debe mezclarse automáticamente con una medida observada de ocasiones de un proveedor externo.

## Otros mercados

Córners, tarjetas, tiros y tiros a puerta tienen estimaciones y líneas separadas en `predictionService.js`. La existencia de una tabla de análisis para un mercado no implica que ese mercado pueda ser tip principal.

El servicio contiene una vía alternativa de ratings que depende de configuración y disponibilidad. La documentación no asume que esté activa en el entorno desplegado.

## Universo de tips

La fuente canónica es [`tipMarkets.js`](../cloudflare/src/services/tipMarkets.js):

| Familia           | Códigos admitidos                                      |
| ----------------- | ------------------------------------------------------ |
| Goles             | `OVER_15`, `OVER_25` y sus variantes `HOME_` / `AWAY_` |
| Ambos marcan      | `BTTS_YES`                                             |
| Doble oportunidad | `DC_1X`, `DC_X2`                                       |
| Tarjetas          | `CARDS_OVER_35`                                        |
| Córners           | `CORNERS_OVER_75`                                      |
| Tiros a puerta    | `SOT_OVER_75`                                          |

El selector público admite porcentajes truncados entre 78 y 95, ordena por probabilidad y utiliza reglas de diversidad en la composición del tablero. Los mercados de tiros totales `SHOTS_*` y las líneas triviales excluidas no entran en ese universo.

La banda 78–95 % es un criterio de selección aplicado a una estimación. La tasa de acierto realizada debe medirse después sobre resultados observados, con tamaño de muestra y cobertura explícitos. Un candidato con alta probabilidad también puede fallar.

La selección principal no utiliza cuotas como puerta de entrada o criterio de clasificación. Otros servicios del backend mantienen cálculos de valor, cuotas o combinaciones para usos distintos; no deben trasladarse sus métricas al Top 10 como si fueran equivalentes.

## Proyección en vivo

[`liveModel.js`](../cloudflare/src/services/liveModel.js) calcula probabilidades condicionadas por el tiempo restante y el marcador. Los mercados ya decididos se diferencian de los que siguen abiertos. Los parámetros previos se conservan como referencia.

El resultado depende de la calidad del minuto, los eventos, el estado y las muestras. Los aplazamientos, cancelaciones o datos incompletos requieren estados específicos, no resultados inventados.

## Evaluación

Los estados `hit`, `miss`, `void` y `pending` describen la liquidación. Los mercados de conteo necesitan las estadísticas pertinentes. Los pendientes o anulados no deben contarse como aciertos decididos.

Para evaluar cambios, registrar período, fuente, mercados, número de selecciones decididas y política de datos ausentes. Separar probabilidad estimada, acierto observado, calibración y métricas económicas cuando correspondan. Las funciones de calibración y backtest del repositorio son herramientas, no evidencia automática de rendimiento en producción.

La revisión actual ejecutó pruebas de regresión y lectura de código; no realizó un backtest nuevo ni una certificación estadística. Consultar [calidad](QUALITY.md).
