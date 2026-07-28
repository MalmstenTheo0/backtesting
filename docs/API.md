# API.md — Contrato de Endpoints

Base URL (desarrollo): `http://localhost:8000`  
Base URL (producción): `https://dca-backtester-api.onrender.com` (reemplazá por la URL real de tu API si deployaste en otro dominio)

Todos los endpoints devuelven `Content-Type: application/json`.

---

## GET /api/v1/health

Verificación de que el servidor está corriendo.

**Response 200**
```json
{
  "status": "ok"
}
```

---

## GET /api/v1/assets

Devuelve la lista curada de activos soportados.

**Response 200**
```json
{
  "assets": [
    {
      "ticker": "BTC-USD",
      "name": "Bitcoin",
      "type": "crypto",
      "data_since": "2017-08-17"
    },
    {
      "ticker": "ETH-USD",
      "name": "Ethereum",
      "type": "crypto",
      "data_since": "2017-08-17"
    },
    {
      "ticker": "SOL-USD",
      "name": "Solana",
      "type": "crypto",
      "data_since": "2020-08-11"
    },
    {
      "ticker": "SPY",
      "name": "S&P 500 ETF",
      "type": "etf",
      "data_since": "1993-01-29"
    },
    {
      "ticker": "QQQ",
      "name": "Nasdaq 100 ETF",
      "type": "etf",
      "data_since": "1999-03-10"
    },
    {
      "ticker": "VTI",
      "name": "Total Market ETF",
      "type": "etf",
      "data_since": "2001-06-15"
    }
  ]
}
```

---

## POST /api/v1/backtest

Ejecuta un backtest y devuelve métricas y datos para el gráfico.

Los precios de **cripto** provienen de la API pública de Binance (velas diarias). Los de **ETFs** se obtienen con Alpha Vantage **`TIME_SERIES_WEEKLY_ADJUSTED`** (cierres semanales). En ambos casos la serie se cachea en el servidor y se entrega con su densidad nativa: la `frequency` del DCA determina **en qué fechas se compra**, no cada cuánto viene un dato.

> **Nota:** la frecuencia `"daily"` **no está disponible para ETFs** (`SPY`, `QQQ`, `VTI`). Usá `"weekly"` o `"monthly"`. Las peticiones con ETF + `daily` reciben **422** (validación en el modelo de request).

### Request Body

```json
{
  "ticker": "BTC-USD",
  "amount_per_period": 100.0,
  "frequency": "monthly",
  "start_date": "2020-01-01",
  "end_date": "2024-12-31",
  "commission_pct": 0.1,
  "strategy": "dca"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `ticker` | string | ✅ | Ticker del activo. Debe existir en `/assets` |
| `amount_per_period` | float | ✅ | Monto a invertir por período en USD. Mínimo: 1.0 |
| `frequency` | enum | ✅ | `"daily"` / `"weekly"` / `"monthly"`. Ver nota arriba para ETFs. |
| `start_date` | string (YYYY-MM-DD) | ✅ | Fecha de inicio del backtest |
| `end_date` | string (YYYY-MM-DD) | ✅ | Fecha de fin del backtest |
| `commission_pct` | float | ❌ | Comisión por operación en %. Default: 0.0 |
| `strategy` | string (enum) | ❌ | Default: `"dca"`. Valores aceptados en el JSON: `"dca"`, `"dca_weighted"`, `"value_averaging"`. Solo **`dca`** está implementado; las otras dos claves son **reservadas** y responden **422** hasta que exista la clase en el registry (ver más abajo). |

### Estrategias reservadas (`strategy`)

El cuerpo del request puede incluir `dca_weighted` o `value_averaging` por compatibilidad futura, pero el motor solo registra **`dca`**. Si enviás una estrategia no registrada, la API responde **422** con `detail` en texto plano, por ejemplo:

```json
{
  "detail": "Estrategia desconocida: 'dca_weighted'. Disponibles: ['dca']"
}
```

(El texto exacto puede variar; las claves disponibles siempre reflejan `STRATEGY_REGISTRY`.)

### Validaciones

- `start_date` debe ser anterior a `end_date`
- El rango mínimo es 30 días
- `ticker` debe pertenecer a la lista curada (si no: **422** con mensaje `Ticker no permitido`, antes de consultar fuentes externas)
- `amount_per_period` debe ser ≥ 1.0
- `commission_pct` debe estar entre 0 y 100
- ETF + `frequency: "daily"` → **422**
- `strategy` no implementada → **422** (ver sección anterior)

### Response 200

```json
{
  "summary": {
    "ticker": "BTC-USD",
    "strategy": "dca",
    "frequency": "monthly",
    "start_date": "2020-01-01",
    "end_date": "2024-12-31",
    "total_periods": 60,
    "amount_per_period": 100.0,
    "commission_pct": 0.1
  },
  "metrics": {
    "total_invested": 6000.0,
    "total_commissions_paid": 6.0,
    "final_value": 18450.32,
    "absolute_return": 12450.32,
    "return_pct": 207.5,
    "cagr_pct": 25.3,
    "total_units": 0.3821
  },
  "lump_sum": {
    "capital": 6000.0,
    "units_bought": 0.8571,
    "final_value": 31420.11,
    "return_pct": 423.67,
    "cagr_pct": 39.2
  },
  "chart_data": [
    {
      "date": "2020-01-01",
      "price": 7200.17,
      "invested": 100.0,
      "portfolio_value": 98.9,
      "is_buy": true
    },
    {
      "date": "2020-01-15",
      "price": 8750.43,
      "invested": 100.0,
      "portfolio_value": 120.17,
      "is_buy": false
    },
    {
      "date": "2020-02-01",
      "price": 9100.22,
      "invested": 200.0,
      "portfolio_value": 252.35,
      "is_buy": true
    }
  ]
}
```

### Descripción de campos — Response

**`summary`**: Echo de los parámetros del request + cantidad de períodos calculados.

**`metrics`** — Resultados del DCA:

| Campo | Descripción |
|---|---|
| `total_invested` | Suma de todos los aportes incluyendo comisiones |
| `total_commissions_paid` | Suma de comisiones pagadas |
| `final_value` | Valor del portfolio al último día del período |
| `absolute_return` | `final_value - total_invested` |
| `return_pct` | Retorno porcentual total |
| `cagr_pct` | Retorno anualizado **ponderado por dinero** (XIRR): descuenta cada aporte desde su propia fecha. Ver la nota de abajo |
| `total_units` | Total de unidades/acciones acumuladas |

> **Sobre `cagr_pct`:** el CAGR clásico supone un único desembolso al inicio, y en un DCA eso no se cumple: el aporte del último mes estuvo invertido semanas, no años. Anualizar con `(final_value / total_invested) ** (1 / años)` trata todo el capital como si hubiera entrado el día uno, lo que **subestima** el rendimiento cuando el activo sube, porque reparte la ganancia sobre más tiempo-dinero del que realmente hubo.
>
> El campo expone la **TIR anualizada (XIRR)**: la tasa que hace cero el valor presente de los flujos en sus fechas reales, tomando cada aporte como salida en su día y el valor final como entrada en el último. Es la métrica estándar de rendimiento ponderado por dinero.
>
> Para un único par de flujos, XIRR y CAGR son la misma ecuación, así que `lump_sum.cagr_pct` no cambia y las dos cifras siguen siendo comparables entre sí.

**`lump_sum`** — Qué hubiera pasado invirtiendo todo el día 1:

| Campo | Descripción |
|---|---|
| `capital` | Mismo capital total que el DCA |
| `units_bought` | Unidades compradas el día 1 con todo el capital |
| `final_value` | Valor al final del período |
| `return_pct` | Retorno porcentual total |
| `cagr_pct` | Retorno anualizado del lump sum. Con un único desembolso inicial, XIRR y CAGR coinciden exactamente, así que es comparable con el `cagr_pct` del DCA |

**`chart_data`** — Un punto por **fecha** de la serie de precios usada en el backtest. La densidad depende de la fuente del activo, no de la `frequency`: cripto tiene un punto por día, los ETFs uno por semana.

`chart_data` conserva **un punto por fecha de cotización**, independientemente de la `frequency`. La frecuencia determina en qué fechas hay compra (`is_buy: true`), no la densidad de la serie: así el gráfico puede mostrar la curva real del valor del portfolio entre una compra y la siguiente.

| Campo | Descripción |
|---|---|
| `date` | Fecha de cotización del punto (YYYY-MM-DD). Siempre un día real con precio en la fuente |
| `price` | Cierre del activo en `date` |
| `invested` | Capital invertido acumulado hasta esa fecha |
| `portfolio_value` | Valor del portfolio DCA en esa fecha |
| `is_buy` | `true` si en esa fecha hubo compra DCA |

> **Cómo se eligen las fechas de compra:** se agrupa la serie por período (semana ISO o mes calendario) y se compra el **primer día con cotización** de cada uno. Así un período no se pierde cuando su primer día no cotiza: si el lunes es feriado, la compra semanal cae el martes; si el día 1 del mes no opera, la mensual cae el primer día hábil.
>
> Las fechas devueltas siempre existen en la serie de precios: `date` y `price` corresponden al mismo día real de mercado en todas las frecuencias.

> **Nota de volumen:** con DCA diario sobre muchos años, el array puede crecer (del orden de miles de puntos). El frontend debe renderizar sin bloquear el hilo principal (p. ej. Recharts).

### Response 422 — Validation Error

Errores de validación del body (Pydantic), rango de fechas, rango mínimo de 30 días, ETF con frecuencia diaria, **ticker no curado** (`Ticker no permitido`), **estrategia reservada sin implementación**, **falta `ALPHAVANTAGE_API_KEY`** al pedir un ETF, mensajes de negocio de Alpha Vantage que el servidor mapea a 422, u otros `ValueError` de validación de rango/datos.

**Ejemplo — ticker no permitido (POST)**

```json
{
  "detail": "Ticker no permitido: 'XYZ'. Debe estar en la lista curada de activos."
}
```

**Ejemplo — estrategia reservada**

```json
{
  "detail": "Estrategia desconocida: 'value_averaging'. Disponibles: ['dca']"
}
```

**Ejemplo — falta clave Alpha Vantage (ETFs)**

```json
{
  "detail": "Falta la variable de entorno ALPHAVANTAGE_API_KEY. Consigue una clave gratuita en https://www.alphavantage.co/support/#api-key y configúrala en el entorno o en backend/.env."
}
```

**Ejemplo — orden de fechas**

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body"],
      "msg": "Value error, start_date debe ser anterior a end_date",
      "input": { }
    }
  ]
}
```

**Ejemplo — ETF con frecuencia diaria**

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body"],
      "msg": "Value error, La frecuencia diaria no está disponible para ETFs en el plan gratuito. Usá frecuencia semanal o mensual.",
      "input": { }
    }
  ]
}
```

(El texto exacto de `msg` puede variar ligeramente según la versión de Pydantic; el mensaje de negocio es el indicado arriba.)

### Response 404 — Datos / ticker en la capa de mercado

Algunos `ValueError` al resolver precios se exponen como **404** cuando el mensaje indica recurso no encontrado, ticker inválido o ticker no soportado **en la capa de datos** (p. ej. respuesta de mercado o metadatos inesperados). Un ticker ajeno a la lista curada **no** cae aquí: se rechaza antes con **422**.

**Ejemplo (ilustrativo; el texto depende de la fuente)**

```json
{
  "detail": "Ticker no soportado: 'FOO'. Use uno de los siguientes: BTC-USD, ETH-USD, SOL-USD, SPY, QQQ, VTI."
}
```

### Response 429 — Límite de frecuencia (Alpha Vantage)

```json
{
  "detail": "Alpha Vantage indica límite de frecuencia (p. ej. 5 peticiones/minuto en el plan gratuito). Espera unos minutos o revisa tu cuota en alphavantage.co."
}
```

### Response 500 — Error interno

```json
{
  "detail": "Internal server error. Please try again."
}
```

---

## Notas de implementación para el frontend

### Cliente HTTP recomendado

```typescript
// services/api.ts — `parseJsonError` y `formatApiError` están en el mismo archivo del repo.
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function runBacktest(
  params: BacktestRequest,
): Promise<BacktestResponse> {
  const res = await fetch(`${API_BASE}/api/v1/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(await parseJsonError(res));
  }
  return res.json() as Promise<BacktestResponse>;
}
```

### Variable de entorno

```bash
# frontend/.env
VITE_API_URL=http://localhost:8000

# frontend/.env.production
VITE_API_URL=https://dca-backtester-api.onrender.com
```
