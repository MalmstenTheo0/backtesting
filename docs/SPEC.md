# SPEC.md — Especificación del Producto

## Visión

Una web app SPA que permite a cualquier persona simular estrategias de inversión sobre datos históricos reales. El usuario configura parámetros (activo, monto, frecuencia, período), ejecuta el backtest, y obtiene métricas claras y visualizaciones que le permiten entender el comportamiento de su estrategia en el pasado.

El foco es en **claridad y honestidad**: mostrar qué hubiera pasado realmente, incluyendo comisiones, comparación con alternativas simples (lump sum), y métricas estándar del mundo financiero.

Los precios del backtest provienen de **Binance** (cripto, velas diarias) y **Alpha Vantage** (ETFs, serie semanal ajustada remuestreada según la frecuencia DCA), con **caché CSV** en el servidor.

---

## MVP — DCA Tradicional

### Qué es DCA

Dollar Cost Averaging (DCA) es una estrategia de inversión que consiste en invertir una cantidad fija de dinero a intervalos regulares, independientemente del precio del activo en ese momento.

**Mecanismo:** Cuando el precio es bajo, el monto fijo compra más unidades. Cuando el precio es alto, compra menos. A lo largo del tiempo, esto promedia el costo de compra y reduce el impacto de la volatilidad.

**Ventaja principal:** Elimina la necesidad de "timing" del mercado. Es mecánico, disciplinado, y psicológicamente sostenible.

**Limitación clave:** En mercados consistentemente alcistas, una inversión lump sum inicial suele superar al DCA en retorno total, porque el capital trabaja antes.

**Estrategias en API:** Solo **`dca`** está implementado en el motor. Los valores `dca_weighted` y `value_averaging` están reservados en el contrato y devuelven error hasta que exista implementación (ver [API.md](API.md)).

---

## Parámetros de configuración (Backtester)

Valores por defecto al cargar la app (pueden cambiar con el tiempo en código; esta tabla refleja la intención actual de UX):

| Parámetro | Tipo | Valores posibles | Default (UI) |
|---|---|---|---|
| Activo | Select (lista curada) | Ver sección Activos | SPY (si está en la lista; si no, el primero disponible) |
| Monto por período | Number | Mínimo $1 (API: ≥ 1.0) | $100 |
| Frecuencia | Select | Diaria / Semanal / Mensual | Mensual |
| Fecha inicio | Date picker + presets | Desde disponibilidad del activo | Inicio del mes de **hace ~5 años** (relativo a hoy) |
| Fecha fin | Date picker | Hasta hoy (acotado al mes en curso en la UI) | Fin del mes actual |
| Presets de rango | Botones | 1 año / 3 años / 5 años / 10 años | — |
| Comisión por operación | Number | % (ej: 0.1) | **0,1%** en el formulario (el backend acepta 0–100; ver API para default si se omite) |

**ETFs y frecuencia diaria:** La UI deshabilita o evita DCA diario para ETFs porque el plan gratuito de datos no lo soporta; el backend rechaza esa combinación con **422**.

---

## Activos soportados (MVP)

Solo los siguientes tickers están cableados en backend y API. Cualquier otro ticker debe considerarse fuera de alcance hasta ampliar `ASSETS` / `CURATED_TICKERS`.

### Cripto

| Ticker | Nombre |
|---|---|
| BTC-USD | Bitcoin |
| ETH-USD | Ethereum |
| SOL-USD | Solana |

### ETFs

| Ticker | Nombre |
|---|---|
| SPY | S&P 500 ETF |
| QQQ | Nasdaq 100 ETF |
| VTI | Total Market ETF |

---

## Motor de cálculo DCA

### Algoritmo por período

Para cada fecha en el rango según la frecuencia elegida (el backend alinea las compras a días hábiles presentes en la serie de precios, p. ej. primer día hábil de cada semana ISO o de cada mes):

```
1. Obtener precio de cierre del activo en esa fecha (serie ya filtrada al rango y frecuencia)
2. unidades_compradas = (monto_periodo - comision_absoluta) / precio
3. unidades_totales += unidades_compradas
4. capital_invertido += monto_periodo
5. valor_portfolio = unidades_totales × precio_del_dia
```

### Cálculo de comisión

```
comision_absoluta = monto_periodo × (comision_pct / 100)
```

### Métricas finales

| Métrica | Fórmula |
|---|---|
| Total invertido | Suma de todos los aportes (incluyendo comisiones) |
| Valor final | unidades_totales × precio_último_día |
| Retorno absoluto | valor_final - total_invertido |
| Retorno % | (retorno_absoluto / total_invertido) × 100 |
| CAGR | ((valor_final / total_invertido) ^ (1 / años)) - 1 |

---

## Comparación Lump Sum

Para cada backtest, se calcula automáticamente qué hubiera pasado invirtiendo todo el capital de una sola vez el primer día:

```
capital_total = monto_periodo × cantidad_periodos
unidades_lump = (capital_total - comision_lump) / precio_dia_1
valor_lump_final = unidades_lump × precio_ultimo_dia
```

Se muestran ambos resultados lado a lado para que el usuario compare.

---

## Visualización (Backtester)

Un gráfico de líneas con el tiempo en el eje X y tres series (escalas lineales; **sin eje log en el MVP actual**):

1. **Precio del activo** — eje Y secundario (derecha)
2. **Capital invertido acumulado** — línea escalonada que sube en cada compra
3. **Valor del portfolio** — línea que sigue el mercado

Sobre la línea de precio: **puntos de compra** marcados (uno por período).

El gráfico permite al usuario ver visualmente:

- Cuándo el portfolio valía menos que lo invertido (underwater)
- Cómo el capital invertido crece de forma escalonada y predecible
- La divergencia entre valor real y capital invertido (la ganancia/pérdida)

---

## UX / Flujo de usuario

### Navegación general

- **Backtester:** configuración + resultados vía API (única pestaña que llama al backend de simulación).
- **Interés compuesto:** calculadora local (Recharts); sin persistencia ni API.
- **Cartera:** asignación porcentual visual local (gráfico tipo torta); **no** es backtest multi-activo ni rebalanceo histórico.
- **Tema:** conmutador claro/oscuro (preferencia guardada en el navegador).

### Flujo — Backtester

```
1. Usuario llega a la app (pestaña Backtester)
2. Selecciona activo de la lista cargada desde GET /api/v1/assets
3. Configura monto, frecuencia, rango de fechas (y comisión si aplica)
4. Hace clic en ejecutar el backtest
5. Ve un estado de carga mientras el backend procesa
6. Aparecen métricas (cards) y gráfico
7. Puede modificar parámetros y recalcular sin recargar la página
8. Puede cambiar de pestaña a las herramientas locales sin perder el contexto del layout (el estado del backtest depende de la implementación actual del hook)
```

---

## Fuera de scope para MVP

- Autenticación y usuarios registrados
- Backtest **multi-activo** (varios tickers en una sola simulación servidor)
- Exportar resultados (PDF, CSV)
- Alertas o notificaciones
- Datos en tiempo real
- Backtesting de múltiples estrategias en paralelo en el mismo request
- Mobile-first (responsive básico sí, pero no optimizado para mobile)

---

## Roadmap post-MVP

### v1.1 — DCA Ponderado (`dca_weighted`)

Ajusta el monto de cada compra según la distancia del precio al promedio histórico. Hoy la clave existe en el contrato de API como reservada.

### v1.2 — Value Averaging (`value_averaging`)

En lugar de invertir un monto fijo, invierte lo necesario para que el portfolio alcance un valor target creciente. Hoy la clave existe en el contrato de API como reservada.

### v1.3 — DCA con Indicadores Técnicos

Condiciona las compras a señales técnicas: RSI < 30, precio bajo MA200, etc. Requiere integrar cálculo de indicadores.

### v2.0 — Multi-estrategia

Comparar múltiples estrategias en el mismo gráfico sobre el mismo activo y período.

### Activos adicionales

Ampliar la lista curada (p. ej. más cripto o acciones) implica cambios en fuentes de datos, caché y validación; no está comprometido en el MVP actual más allá de los seis tickers listados arriba.
