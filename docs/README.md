# DCA Backtester

Web app para simular y analizar estrategias de inversión sobre datos históricos reales.

## Estado del proyecto

MVP en desarrollo — Estrategia inicial: DCA Tradicional.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript |
| Gráficos | Recharts |
| Estilos | Tailwind CSS |
| Backend | FastAPI (Python 3.12) |
| Datos | yfinance + caché CSV local |
| Cálculo | pandas + numpy |

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

Ver [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) para instrucciones completas de setup.

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

- [SPEC.md](docs/SPEC.md) — Especificación del producto: qué construimos y por qué
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — Decisiones técnicas y estructura del sistema
- [API.md](docs/API.md) — Contratos de endpoints (request/response schemas)
- [STRATEGY_GUIDE.md](docs/STRATEGY_GUIDE.md) — Cómo agregar nuevas estrategias
- [DEVELOPMENT.md](docs/DEVELOPMENT.md) — Setup local, comandos, troubleshooting

## Roadmap de estrategias

1. ✅ **DCA Tradicional** — MVP
2. 🔜 **DCA Ponderado** — Ajusta monto según precio relativo o señal técnica
3. 🔜 **Value Averaging** — Invierte lo necesario para alcanzar un target de portfolio
4. 🔜 **DCA con Indicadores** — Condicional por RSI, MA200, etc.
