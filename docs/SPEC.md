# SPEC.md — Especificación del Producto

## Visión

Una web app SPA que permite a cualquier persona simular estrategias de inversión sobre datos históricos reales. El usuario configura parámetros (activo, monto, frecuencia, período), ejecuta el backtest, y obtiene métricas claras y visualizaciones que le permiten entender el comportamiento de su estrategia en el pasado.

El foco es en **claridad y honestidad**: mostrar qué hubiera pasado realmente, incluyendo comisiones, comparación con alternativas simples (lump sum), y métricas estándar del mundo financiero.

---

## MVP — DCA Tradicional

### Qué es DCA

Dollar Cost Averaging (DCA) es una estrategia de inversión que consiste en invertir una cantidad fija de dinero a intervalos regulares, independientemente del precio del activo en ese momento.

**Mecanismo:** Cuando el precio es bajo, el monto fijo compra más unidades. Cuando el precio es alto, compra menos. A lo largo del tiempo, esto promedia el costo de compra y reduce el impacto de la volatilidad.

**Ventaja principal:** Elimina la necesidad de "timing" del mercado. Es mecánico, disciplinado, y psicológicamente sostenible.

**Limitación clave:** En mercados consistentemente alcistas, una inversión lump sum inicial suele superar al DCA en retorno total, porque el capital trabaja antes.

---

## Parámetros de configuración

| Parámetro | Tipo | Valores posibles | Default |
|---|---|---|---|
| Activo | Select (lista curada) | Ver sección Activos | BTC-USD |
| Monto por período | Number | Mínimo $1 | $100 |
| Frecuencia | Select | Diaria / Semanal / Mensual | Mensual |
| Fecha inicio | Date picker | Desde disponibilidad del activo | Hace 3 años |
| Fecha fin | Date picker | Hasta hoy | Hoy |
| Presets de rango | Botones | 1 año / 3 años / 5 años / 10 años | — |
| Comisión por operación | Number opcional | % (ej: 0.1) | 0% |

---

## Activos soportados (MVP)

### Crypto
| Ticker | Nombre |
|---|---|
| BTC-USD | Bitcoin |
| ETH-USD | Ethereum |
| SOL-USD | Solana |
| BNB-USD | BNB |

### Acciones y ETFs
| Ticker | Nombre |
|---|---|
| SPY | S&P 500 ETF |
| QQQ | Nasdaq 100 ETF |
| VTI | Total Market ETF |
| VOO | Vanguard S&P 500 |
| AAPL | Apple |
| MSFT | Microsoft |
| NVDA | NVIDIA |
| AMZN | Amazon |
| GOOGL | Alphabet |

---

## Motor de cálculo DCA

### Algoritmo por período

Para cada fecha en el rango según la frecuencia elegida:

```
1. Obtener precio de cierre ajustado del activo en esa fecha
2. Si no hay datos ese día (feriado/fin de semana), usar el último precio disponible
3. unidades_compradas = (monto_periodo - comision_absoluta) / precio
4. unidades_totales += unidades_compradas
5. capital_invertido += monto_periodo
6. valor_portfolio = unidades_totales × precio_del_dia
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

## Visualización

Un gráfico de líneas con el tiempo en el eje X y tres series:

1. **Precio del activo** — eje Y secundario (derecha), escala logarítmica opcional
2. **Capital invertido acumulado** — línea escalonada que sube en cada compra
3. **Valor del portfolio** — línea que sigue el mercado

Sobre la línea de precio: **puntos de compra** marcados (uno por período).

El gráfico permite al usuario ver visualmente:
- Cuándo el portfolio valía menos que lo invertido (underwater)
- Cómo el capital invertido crece de forma escalonada y predecible
- La divergencia entre valor real y capital invertido (la ganancia/pérdida)

---

## UX / Flujo de usuario

```
1. Usuario llega a la app
2. Selecciona activo de la lista
3. Configura monto, frecuencia, rango de fechas
4. Opcionalmente, agrega comisión
5. Hace clic en "Calcular" / "Run Backtest"
6. Ve un loading state mientras el backend procesa
7. Aparecen métricas (cards superiores) y gráfico
8. Puede modificar parámetros y recalcular sin recargar la página
```

---

## Fuera de scope para MVP

- Autenticación y usuarios registrados
- Portfolio multi-activo (múltiples tickers simultáneos)
- Exportar resultados (PDF, CSV)
- Alertas o notificaciones
- Datos en tiempo real
- Backtesting de múltiples estrategias en paralelo
- Mobile-first (responsive básico sí, pero no optimizado para mobile)

---

## Roadmap post-MVP

### v1.1 — DCA Ponderado
Ajusta el monto de cada compra según la distancia del precio al promedio histórico. Compra más cuando está "barato" y menos cuando está "caro" (definido por algún indicador como MA200 o Z-score).

### v1.2 — Value Averaging
En lugar de invertir un monto fijo, invierte lo necesario para que el portfolio alcance un valor target creciente. Más complejo, requiere capital de reserva.

### v1.3 — DCA con Indicadores Técnicos
Condiciona las compras a señales técnicas: RSI < 30, precio bajo MA200, etc. Requiere integrar cálculo de indicadores.

### v2.0 — Multi-estrategia
Comparar múltiples estrategias en el mismo gráfico sobre el mismo activo y período.
