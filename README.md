# DCA Backtester

Web app para simular estrategias DCA sobre datos históricos (Binance para cripto, Alpha Vantage para ETFs, con caché local). Incluye pestañas de **calculadora de interés compuesto** y **asignación de cartera** solo en el navegador, además del backtester. Documentación en [docs/README.md](docs/README.md).

## Inicio rápido

```bash
cd backend && python -m venv venv && .\venv\Scripts\activate && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend && npm install && npm run dev
```

Con **Docker** (back + front juntos): en la raíz del repo, `docker compose up --build`. Requisitos y detalles en [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#docker-desarrollo).
