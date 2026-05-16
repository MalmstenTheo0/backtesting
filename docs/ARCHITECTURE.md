# ARCHITECTURE.md — Arquitectura del Sistema

## Diagrama general

```
┌──────────────────────────────────────────────┐
│              FRONTEND (React + Vite)         │
│  Pestañas: Backtester | Interés compuesto    │
│            | Cartera (local)                 │
│  Backtester: ConfigPanel → ResultsPanel      │
│               → BacktestChart                 │
│  Tema claro/oscuro (ThemeToggle)             │
│  Puerto: 5173 (dev)                          │
└────────────────────┬─────────────────────────┘
                     │ HTTP REST (JSON)
                     │ GET /api/v1/health
                     │ GET /api/v1/assets
                     │ POST /api/v1/backtest
                     ▼
┌──────────────────────────────────────────────┐
│           BACKEND (FastAPI)                  │
│  /api/v1 → health, assets, backtest          │
│           ↓                                  │
│     Strategy registry → Strategy.run()       │
│           ↓                                  │
│     Data fetcher (caché + fuentes)           │
│           ↓                                  │
│     Binance (crypto) / Alpha Vantage (ETF)   │
│  Puerto: 8000 (dev)                          │
└──────────────────────────────────────────────┘
```

---

## Estructura de carpetas

```
dca-backtester/
├── README.md
├── docker-compose.yml
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
│       ├── App.tsx                       # Pestañas + tema + layout
│       ├── components/
│       │   ├── ConfigPanel/
│       │   │   ├── ConfigPanel.tsx       # Formulario principal del backtest
│       │   │   ├── AssetSelector.tsx
│       │   │   ├── FrequencySelector.tsx
│       │   │   ├── configPanelConstants.ts
│       │   │   └── DateRangePicker/      # Calendario + presets (subcomponentes)
│       │   ├── ResultsPanel/
│       │   │   ├── ResultsPanel.tsx
│       │   │   ├── MetricCard.tsx
│       │   │   └── ComparisonTable.tsx
│       │   ├── Chart/
│       │   │   ├── BacktestChart.tsx
│       │   │   └── ChartTooltip.tsx
│       │   ├── ThemeToggle/
│       │   │   └── ThemeToggle.tsx
│       │   ├── CompoundCalculator/
│       │   │   └── CompoundCalculator.tsx  # Solo cliente
│       │   └── PortfolioAllocator/
│       │       └── PortfolioAllocator.tsx  # Solo cliente
│       ├── hooks/
│       │   └── useBacktest.ts
│       ├── services/
│       │   └── api.ts                    # health, assets, backtest + errores
│       ├── lib/
│       │   ├── format.ts
│       │   ├── themeStorage.ts           # Persistencia del tema
│       │   └── deriveBuyRows.ts          # Filas recientes de compras (UI)
│       ├── types/
│       │   └── index.ts
│       └── constants/
│           └── assets.ts                 # Metadatos extra para la UI (p. ej. dataFrom)
│
└── backend/
    ├── requirements.txt
    ├── .env.example
    └── app/
        ├── main.py                       # FastAPI app + CORS
        ├── constants.py                  # CURATED_TICKERS (validación backtest)
        ├── api/
        │   └── v1/
        │       ├── router.py             # Prefijo /api/v1
        │       └── endpoints/
        │           ├── health.py         # GET /health
        │           ├── backtest.py       # POST /backtest
        │           └── assets.py         # GET /assets
        ├── strategies/
        │   ├── base.py                   # Strategy, dataclasses de resultado
        │   ├── dca.py                    # DCA tradicional
        │   └── registry.py               # nombre → clase; get_strategy() devuelve instancia
        ├── data/
        │   ├── fetcher.py                # Caché, locks por archivo, get_prices()
        │   ├── sources/
        │   │   ├── __init__.py
        │   │   ├── binance.py            # Klines públicos (crypto)
        │   │   └── alphavantage.py       # ETFs: TIME_SERIES_WEEKLY_ADJUSTED (+ helpers)
        │   └── cache/                    # CSVs (gitignored)
        └── models/
            ├── request.py                # BacktestRequest, enums Frequency / StrategyName
            └── response.py               # DTOs de respuesta + HealthResponse
```

---

## Decisiones técnicas

### Por qué FastAPI + Python
El ecosistema financiero en Python (pandas, numpy, requests a APIs de mercado) no tiene equivalente en otros lenguajes. FastAPI provee una API REST asíncrona con validación automática via Pydantic y generación de docs OpenAPI sin configuración extra.

### Por qué Binance + Alpha Vantage con caché local

**Crypto (BTC, ETH, SOL):** API pública de Binance (`/api/v3/klines`), sin API key. Velas diarias; el caché guarda solo **Date** y **Close** en `{TICKER}.csv` (ej. `BTC-USD.csv`).

**ETFs (SPY, QQQ, VTI):** Siempre se descarga **`TIME_SERIES_WEEKLY_ADJUSTED`** (plan gratuito, historial largo, cierre ajustado). El archivo de caché es `{TICKER}_wav.csv`. Para DCA **semanal** o **mensual**, `get_prices()` remuestrea la serie semanal con `resample` a la frecuencia pedida. La frecuencia **diaria** para ETFs está bloqueada en validación (plan gratuito / coherencia de datos).

**Caché y frescura:** además de `CACHE_MAX_AGE_HOURS` (por defecto 24 h), si el último **Date** del CSV está “demasiado viejo” respecto a hoy, se fuerza re-descarga: **1 día** para crypto, **7 días** para ETF (`_MAX_DATA_STALENESS_DAYS` en `fetcher.py`). Hay **locks** por nombre de archivo para evitar condiciones de carrera si dos requests calientan el mismo ticker.

**Swap path:** cambiar fuente implica principalmente `sources/binance.py` o `sources/alphavantage.py`; el contrato de `get_prices()` se mantiene.

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
4. Si el nombre es parte del contrato público, añadirlo al enum `StrategyName` en `models/request.py` y documentar en `API.md`

El endpoint `/backtest` no debería necesitar cambios de routing al agregar estrategias; sí puede requerirse ampliar validación o parámetros en el modelo de request.

```python
# app/strategies/base.py
from abc import ABC, abstractmethod
import pandas as pd
# BacktestResult y demás dataclasses de resultado se definen en este mismo módulo.

class Strategy(ABC):
    @abstractmethod
    def run(self, prices: pd.Series, params: dict) -> "BacktestResult":
        ...
```

`BacktestResult` y tipos relacionados (`BacktestMetrics`, `DailySnapshot`, etc.) viven en **`app.strategies.base`**, no en `app.models.response` (esos son DTOs Pydantic para JSON).

### Por qué Recharts y no Chart.js / D3

Recharts está construido sobre D3 pero expone una API declarativa en React con componentes nativos. Permite el gráfico de múltiples ejes (precio del activo en eje derecho, valores de portfolio en eje izquierdo) con tooltips custom sin escribir D3 imperativo. Es la opción más pragmática para este caso.

### Estado en frontend

No se usa Redux ni Zustand. El estado del backtest vive en el hook `useBacktest` con `useState` + `useCallback`. El tema claro/oscuro se guarda en `localStorage` (`themeStorage.ts`). Las pestañas de calculadora y cartera son estado local en sus componentes. Si el proyecto crece hacia multi-estrategia o comparaciones complejas, se evalúa agregar Zustand en ese momento.

---

## CORS

El backend configura CORS para aceptar requests desde `localhost:5173` (dev) y el dominio de Vercel (producción). Se configura en `main.py` via `CORSMiddleware`.

---

## Variables de entorno

```bash
# backend/.env
CACHE_DIR=app/data/cache          # Dónde guardar los CSVs
CACHE_MAX_AGE_HOURS=24            # Antigüedad máxima del archivo de caché (horas)
ALLOWED_ORIGINS=http://localhost:5173
ALPHAVANTAGE_API_KEY=...          # Requerida para ETFs (Alpha Vantage)
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
