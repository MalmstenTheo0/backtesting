# DCA Backtester

Web app para simular estrategias DCA sobre datos históricos. Documentación en [docs/README.md](docs/README.md).

## Inicio rápido

```bash
cd backend && python -m venv venv && .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend; npm install; npm run dev
```
