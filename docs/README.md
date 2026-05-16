# DCA Backtester

Web app para simular y analizar estrategias de inversión sobre datos históricos reales.

## Estado del proyecto

MVP en desarrollo — Motor de backtest: **DCA tradicional** (`strategy: "dca"`). Los valores `dca_weighted` y `value_averaging` existen en el contrato de API como **reservados** y devuelven 422 hasta que haya implementación.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript |
| Gráficos | Recharts |
| Estilos | Tailwind CSS |
| Backend | FastAPI (Python 3.12) |
| Datos | API pública Binance (cripto) + Alpha Vantage `TIME_SERIES_WEEKLY_ADJUSTED` (ETFs) + caché CSV local (`Date`, `Close`) |
| Cálculo | pandas + numpy |

La SPA incluye pestañas **Backtester** (llama al API), **Interés compuesto** y **Cartera** (cálculos locales, sin backend).

## Estructura del repositorio

```
/
├── frontend/           # React SPA
├── backend/            # FastAPI server
├── docs/               # Documentación del proyecto
│   ├── SPEC.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── STRATEGY_GUIDE.md
│   └── DEVELOPMENT.md
└── README.md
```

## Inicio rápido

Ver [DEVELOPMENT.md](DEVELOPMENT.md) para instrucciones completas de setup.

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Documentación

- [SPEC.md](SPEC.md) — Especificación del producto: qué construimos y por qué
- [ARCHITECTURE.md](ARCHITECTURE.md) — Decisiones técnicas y estructura del sistema
- [API.md](API.md) — Contratos de endpoints (request/response schemas)
- [STRATEGY_GUIDE.md](STRATEGY_GUIDE.md) — Cómo agregar nuevas estrategias
- [DEVELOPMENT.md](DEVELOPMENT.md) — Setup local, comandos, troubleshooting

## Roadmap de estrategias

1. ✅ **DCA Tradicional** — Implementado (`dca`).
2. 🔒 **DCA Ponderado** — Reservado en API (`dca_weighted`); pendiente de implementación en el registry.
3. 🔒 **Value Averaging** — Reservado en API (`value_averaging`); pendiente de implementación en el registry.
4. 🔜 **DCA con Indicadores** — Condicional por RSI, MA200, etc. (sin clave en el contrato actual).
