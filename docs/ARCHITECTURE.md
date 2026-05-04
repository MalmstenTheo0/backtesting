# ARCHITECTURE.md — Arquitectura del Sistema

## Diagrama general

```
┌─────────────────────────────────┐
│         FRONTEND (React)        │
│                                 │
│  ConfigPanel → ResultsPanel     │
│                 Chart           │
│                                 │
│  Puerto: 5173 (dev)             │
└────────────────┬────────────────┘
                 │ HTTP REST (JSON)
                 │ POST /api/v1/backtest
                 ▼
┌─────────────────────────────────┐
│        BACKEND (FastAPI)        │
│                                 │
│  Router → Strategy Engine       │
│           ↓                     │
│        Data Fetcher             │
│           ↓                     │
│        Cache (CSV local)        │
│           ↓                     │
│   Binance API / Alpha Vantage   │
│                                 │
│  Puerto: 8000 (dev)             │
└─────────────────────────────────┘
```

---

## Estructura de carpetas

```
dca-backtester/
├── README.md
├── docs/
│   ├── SPEC.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── STRATEGY_GUIDE.md
│   └── DEVELOPMENT.md
│
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── ConfigPanel/
│       │   │   ├── ConfigPanel.tsx       # Formulario principal
│       │   │   ├── AssetSelector.tsx     # Select de activos curados
│       │   │   ├── DateRangePicker.tsx   # Date picker + presets
│       │   │   └── FrequencySelector.tsx
│       │   ├── ResultsPanel/
│       │   │   ├── ResultsPanel.tsx      # Contenedor de resultados
│       │   │   ├── MetricCard.tsx        # Card individual de métrica
│       │   │   └── ComparisonTable.tsx   # DCA vs Lump Sum
│       │   └── Chart/
│       │       ├── BacktestChart.tsx     # Gráfico principal (Recharts)
│       │       └── ChartTooltip.tsx      # Tooltip custom
│       ├── hooks/
│       │   └── useBacktest.ts            # Estado y lógica de la llamada API
│       ├── services/
│       │   └── api.ts                    # Cliente HTTP hacia FastAPI
│       ├── types/
│       │   └── index.ts                  # TypeScript types compartidos
│       └── constants/
│           └── assets.ts                 # Lista curada de activos
│
└── backend/
    ├── requirements.txt
    ├── .env.example
    └── app/
        ├── main.py                       # FastAPI app + CORS
        ├── api/
        │   └── v1/
        │       ├── router.py             # Agrupa todos los endpoints v1
        │       └── endpoints/
        │           ├── backtest.py       # POST /backtest
        │           └── assets.py         # GET /assets
        ├── strategies/
        │   ├── base.py                   # Clase abstracta Strategy
        │   ├── dca.py                    # DCA Tradicional
        │   └── registry.py              # Mapa nombre → clase
        ├── data/
        │   ├── fetcher.py               # Dispatcher: Binance (crypto) o Alpha Vantage (ETFs)
        │   ├── sources/
        │   │   ├── __init__.py
        │   │   ├── binance.py           # Klines públicos, sin API key
        │   │   └── alphavantage.py      # TIME_SERIES_DAILY/WEEKLY/MONTHLY, requiere key
        │   └── cache/                   # CSVs por ticker (gitignored)
        └── models/
            ├── request.py               # Pydantic: BacktestRequest
            └── response.py              # Pydantic: BacktestResponse
```

---

## Decisiones técnicas

### Por qué FastAPI + Python
El ecosistema financiero en Python (pandas, numpy, requests a APIs de mercado) no tiene equivalente en otros lenguajes. FastAPI provee una API REST asíncrona con validación automática via Pydantic y generación de docs OpenAPI sin configuración extra.

### Por qué Binance + Alpha Vantage con caché local

**Crypto (BTC, ETH, SOL):** Se usa la API pública de Binance (`/api/v3/klines`), sin API key. Devuelve velas OHLCV históricas con paginación de 1000 registros. Sin rate limiting severo para datos históricos.

**ETFs (SPY, QQQ, VTI):** Se usa Alpha Vantage con API key gratuita. El endpoint varía según la frecuencia del backtest: `TIME_SERIES_MONTHLY` para DCA mensual, `TIME_SERIES_WEEKLY` para semanal, y `TIME_SERIES_DAILY` (compact) para diario. El historial completo en diario requiere plan premium.

**Caché CSV:** igual que antes — primera descarga completa, se guarda en `cache/{ticker}_{sampling}.csv` con columnas `Date,Close`. Las llamadas siguientes leen del CSV si tiene menos de 24 horas.

**Swap path:** si alguna fuente falla, solo hay que tocar `sources/binance.py` o `sources/alphavantage.py`. El dispatcher y el resto del sistema no cambian.

### Activos soportados

| Ticker   | Tipo   |
|----------|--------|
| BTC-USD  | Crypto |
| ETH-USD  | Crypto |
| SOL-USD  | Crypto |
| SPY      | ETF    |
| QQQ      | ETF    |
| VTI      | ETF    |

### Por qué la estrategia es una clase abstracta

Para que agregar DCA Ponderado, Value Averaging, o cualquier otra estrategia sea:
1. Crear un archivo nuevo en `strategies/`
2. Extender `Strategy` e implementar `run()`
3. Registrar en `registry.py`

El endpoint `/backtest` no necesita cambiar nunca.

```python
# strategies/base.py
from abc import ABC, abstractmethod
import pandas as pd
from app.models.response import BacktestResult

class Strategy(ABC):
    @abstractmethod
    def run(self, prices: pd.Series, params: dict) -> BacktestResult:
        """
        Ejecuta el backtest sobre la serie de precios.
        
        Args:
            prices: Serie temporal con índice DatetimeIndex y precios de cierre ajustados
            params: Diccionario con parámetros específicos de la estrategia
            
        Returns:
            BacktestResult con métricas y datos para el gráfico
        """
        ...
```

### Por qué Recharts y no Chart.js / D3

Recharts está construido sobre D3 pero expone una API declarativa en React con componentes nativos. Permite el gráfico de múltiples ejes (precio del activo en eje derecho, valores de portfolio en eje izquierdo) con tooltips custom sin escribir D3 imperativo. Es la opción más pragmática para este caso.

### Estado en frontend

No se usa Redux ni Zustand. El estado del backtest vive en el hook `useBacktest` con `useState` + `useCallback`. Si el proyecto crece hacia multi-estrategia o comparaciones complejas, se evalúa agregar Zustand en ese momento.

---

## CORS

El backend configura CORS para aceptar requests desde `localhost:5173` (dev) y el dominio de Vercel (producción). Se configura en `main.py` via `CORSMiddleware`.

---

## Variables de entorno

```bash
# backend/.env
CACHE_DIR=app/data/cache          # Dónde guardar los CSVs
CACHE_MAX_AGE_HOURS=24            # Cuándo refrescar el caché
ALLOWED_ORIGINS=http://localhost:5173
```

---

## Consideraciones de performance

El cálculo DCA es O(n) donde n es la cantidad de períodos. Para un DCA diario de 10 años son ~3650 iteraciones — prácticamente instantáneo en Python/pandas.

El cuello de botella real es la primera descarga de datos vía Binance o Alpha Vantage. Con el caché, las llamadas subsiguientes son <50ms.

---

## Deploy (post-MVP)

| Servicio | Plataforma | Notas |
|---|---|---|
| Frontend | Vercel | Build estático de Vite, zero-config |
| Backend | Render | Free tier tiene cold start de ~30s, plan básico ($7/mes) lo elimina |
| Caché | Render disk | El caché CSV persiste en disco en Render con persistent disk |

En producción, la variable `ALLOWED_ORIGINS` incluye el dominio de Vercel.
