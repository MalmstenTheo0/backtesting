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
│        yfinance                 │
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
        │   ├── fetcher.py               # yfinance wrapper con caché
        │   └── cache/                   # CSVs por ticker (gitignored)
        └── models/
            ├── request.py               # Pydantic: BacktestRequest
            └── response.py              # Pydantic: BacktestResponse
```

---

## Decisiones técnicas

### Por qué FastAPI + Python
El ecosistema financiero en Python (pandas, numpy, yfinance) no tiene equivalente en otros lenguajes. FastAPI provee una API REST asíncrona con validación automática via Pydantic y generación de docs OpenAPI sin configuración extra.

### Por qué yfinance con caché local

**Problema:** yfinance no es una API oficial — scrapea Yahoo Finance. Puede fallar por rate limiting o cambios en la estructura de Yahoo.

**Solución:** Sistema de caché en CSV local.
- La primera vez que se pide un ticker, se descargan todos los datos históricos disponibles y se guardan en `backend/app/data/cache/{ticker}.csv`
- Las siguientes llamadas leen del CSV
- El CSV se refresca si tiene más de 24 horas (para obtener datos recientes)

```python
# Lógica del fetcher
def get_prices(ticker: str, start: date, end: date) -> pd.Series:
    cache_path = CACHE_DIR / f"{ticker}.csv"
    
    if cache_path.exists() and not is_stale(cache_path):
        df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
    else:
        df = yf.download(ticker, period="max", auto_adjust=True)
        df.to_csv(cache_path)
    
    return df["Close"].loc[start:end]
```

**Por qué no Alpha Vantage / FMP / Polygon:**
- Alpha Vantage: 25 requests/día en free tier — inviable para un backtester interactivo
- FMP: 250 requests/día — marginal, requiere API key
- Polygon: free tier muy limitado (5 calls/min, 2 años de historia)
- yfinance + caché elimina la mayoría de los problemas de rate limiting porque la red se toca una sola vez por ticker

**Swap path:** Si yfinance se vuelve inestable, el fetcher está aislado en `data/fetcher.py`. Cambiar la implementación no afecta las estrategias ni los endpoints.

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

El cuello de botella real es la primera descarga de datos via yfinance. Con el caché, las llamadas subsiguientes son <50ms.

---

## Deploy (post-MVP)

| Servicio | Plataforma | Notas |
|---|---|---|
| Frontend | Vercel | Build estático de Vite, zero-config |
| Backend | Render | Free tier tiene cold start de ~30s, plan básico ($7/mes) lo elimina |
| Caché | Render disk | El caché CSV persiste en disco en Render con persistent disk |

En producción, la variable `ALLOWED_ORIGINS` incluye el dominio de Vercel.
