# API.md — Contrato de Endpoints

Base URL (desarrollo): `http://localhost:8000`  
Base URL (producción): `https://dca-backtester-api.onrender.com`

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

Los precios de **cripto** provienen de la API pública de Binance; los de **ETFs** de Alpha Vantage (con caché local configurable en el servidor).

> **Nota:** la frecuencia `"daily"` **no está disponible para ETFs** (`SPY`, `QQQ`, `VTI`) en el plan gratuito de datos. Para esos activos usá `"weekly"` o `"monthly"`. Las peticiones con ETF + `daily` reciben **422**.

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
| `strategy` | enum | ❌ | Estrategia a usar. Default: `"dca"`. Valores futuros: `"dca_weighted"`, `"value_averaging"` |

### Validaciones

- `start_date` debe ser anterior a `end_date`
- El rango mínimo es 30 días
- `ticker` debe pertenecer a la lista curada
- `amount_per_period` debe ser > 0
- `commission_pct` debe estar entre 0 y 100
- ETF + `frequency: "daily"` → rechazado (422)

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
| `cagr_pct` | Tasa de crecimiento anual compuesta |
| `total_units` | Total de unidades/acciones acumuladas |

**`lump_sum`** — Qué hubiera pasado invirtiendo todo el día 1:

| Campo | Descripción |
|---|---|
| `capital` | Mismo capital total que el DCA |
| `units_bought` | Unidades compradas el día 1 con todo el capital |
| `final_value` | Valor al final del período |
| `return_pct` | Retorno porcentual total |
| `cagr_pct` | CAGR del lump sum |

**`chart_data`** — Array de puntos para el gráfico (un punto por día del rango):

| Campo | Descripción |
|---|---|
| `date` | Fecha del punto (YYYY-MM-DD) |
| `price` | Precio de cierre ajustado del activo |
| `invested` | Capital invertido acumulado hasta ese día |
| `portfolio_value` | Valor del portfolio DCA ese día |
| `is_buy` | `true` si ese día se realizó una compra |

> **Nota de performance:** `chart_data` puede tener hasta ~3650 puntos (10 años diarios). El frontend debe manejar este volumen eficientemente — Recharts lo hace sin problemas.

### Response 422 — Validation Error

Errores de validación del body (Pydantic), rango de fechas, rango mínimo de 30 días, ETF con frecuencia diaria, ticker no curado, u otros errores de negocio devueltos como 422.

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

### Response 404 — Recurso / ticker no encontrado en la fuente

Cuando el mensaje de error indica explícitamente recurso no encontrado o ticker no soportado por la capa de datos, por ejemplo:

```json
{
  "detail": "Ticker no soportado: 'XYZ'. Use uno de los siguientes: BTC-USD, ETH-USD, QQQ, SOL-USD, SPY, VTI."
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
// services/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function runBacktest(params: BacktestRequest): Promise<BacktestResponse> {
  const res = await fetch(`${API_BASE}/api/v1/backtest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.detail || 'Error running backtest')
  }
  
  return res.json()
}
```

### Variable de entorno

```bash
# frontend/.env
VITE_API_URL=http://localhost:8000

# frontend/.env.production
VITE_API_URL=https://dca-backtester-api.onrender.com
```
