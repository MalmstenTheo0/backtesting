# DEVELOPMENT.md — Setup y flujo de desarrollo

## Prerequisitos

- Python 3.12+
- Node.js 20+
- npm 10+
- Git

Para levantar todo con Docker: [Docker Engine](https://docs.docker.com/engine/install/) o **Docker Desktop** (Windows/macOS). En Windows, si el hot-reload con volúmenes montados va lento, conviene usar WSL2 como backend de Docker.

---

## Docker (desarrollo)

Desde la raíz del repositorio, con backend y frontend en un solo comando (hot-reload activado):

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000` (Swagger: `/docs`)

**Variables de entorno:** opcionalmente copiá `backend/.env.example` a `backend/.env` antes de arrancar (misma convención que sin Docker). Si no existe `.env`, Compose igual arranca; para ETFs hace falta `ALPHAVANTAGE_API_KEY` en `.env`.

**Red y CORS:** el navegador llama al API en `http://localhost:8000` (no uses el hostname interno `backend` en `VITE_API_URL`). En `docker-compose.yml` ya está `VITE_API_URL=http://localhost:8000` y `ALLOWED_ORIGINS=http://localhost:5173`.

**Frontend `node_modules`:** se usa un volumen nombrado para no pisar los módulos del contenedor al montar `./frontend`. Si cambiás dependencias en `package.json`, reconstruí la imagen del frontend: `docker compose build frontend` (o `up --build`).

---

## Setup inicial (primera vez)

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/dca-backtester.git
cd dca-backtester
```

### 2. Setup del Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# macOS / Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Copiar variables de entorno
cp .env.example .env

# Crear directorio de caché (si no existe)
mkdir -p app/data/cache
```

### 3. Setup del Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
```

---

## Correr el proyecto en desarrollo

Necesitás **dos terminales** abiertas simultáneamente.

### Terminal 1 — Backend

```bash
cd backend
source venv/bin/activate  # o venv\Scripts\activate en Windows
uvicorn app.main:app --reload --port 8000
```

El backend estará disponible en: `http://localhost:8000`  
Documentación automática (Swagger): `http://localhost:8000/docs`

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

El frontend estará disponible en: `http://localhost:5173`

---

## Variables de entorno

### Backend (`backend/.env`)

```bash
# Directorio donde se guardan los CSVs de caché
CACHE_DIR=app/data/cache

# Horas antes de refrescar el caché de un ticker
CACHE_MAX_AGE_HOURS=24

# Orígenes permitidos para CORS (separados por coma)
ALLOWED_ORIGINS=http://localhost:5173

# Requerida para ETFs. Key gratuita en https://www.alphavantage.co/support/#api-key
ALPHAVANTAGE_API_KEY=your_key_here
```

### Frontend (`frontend/.env`)

```bash
# URL del backend
VITE_API_URL=http://localhost:8000
```

---

## Dependencias del Backend

```txt
# requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.0
requests==2.32.3
pandas==2.2.3
numpy==2.1.1
python-dotenv==1.0.1
```

---

## Dependencias del Frontend

Las principales (en `package.json`):

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.13.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.5.3",
    "vite": "^5.4.8"
  }
}
```

---

## Estructura de caché

Los datos de precios se guardan en `backend/app/data/cache/` como CSVs:

```
cache/
├── BTC-USD.csv
├── ETH-USD.csv
├── SPY.csv
└── AAPL.csv
```

Cada archivo tiene el formato:

```csv
Date,Open,High,Low,Close,Volume
2020-01-01,7200.17,7254.33,7100.00,7200.17,28477823
...
```

El directorio `cache/` está en `.gitignore` — los datos no se versiona, se descargan en runtime.

---

## Flujo de desarrollo con Cursor

Este proyecto está diseñado para trabajar con Cursor como agente de código. El contexto para Cursor está en `/docs`.

### Prompt de onboarding para Cursor

Al abrir el proyecto en Cursor por primera vez, usar este prompt:

```
Leé todos los archivos en /docs antes de hacer cualquier cosa.
El proyecto es un backtester de estrategias de inversión.
La arquitectura está en ARCHITECTURE.md, el contrato de API en API.md,
y cómo agregar estrategias en STRATEGY_GUIDE.md.
```

### Flujo por feature

Para cada nueva feature:
1. Definir en Claude (claude.ai) qué se va a construir
2. Actualizar el doc relevante si hace falta
3. Darle a Cursor el contexto específico de la feature
4. Cursor implementa
5. Revisar en Claude si la lógica de negocio es correcta

---

## Comandos útiles

### Backend

```bash
# Correr tests (cuando se agreguen)
pytest

# Formatear código
black app/

# Type checking
mypy app/

# Limpiar caché de datos
rm -rf app/data/cache/*.csv

# Ver logs del servidor
uvicorn app.main:app --reload --log-level debug
```

### Frontend

```bash
# Build de producción
npm run build

# Preview del build de producción
npm run preview

# Type checking
npx tsc --noEmit

# Lint
npm run lint
```

---

## Troubleshooting

### Alpha Vantage devuelve error de límite para ETFs

El plan gratuito permite 25 requests/día. Con el caché CSV esto raramente es un problema — cada ticker se descarga una sola vez por día. Si limpiaste el caché y pedís varios ETFs seguidos, esperá hasta el día siguiente o conseguí una key premium.

Los ETFs se cargan con `TIME_SERIES_WEEKLY_ADJUSTED` (historial largo en plan gratuito); el DCA diario/semanal/mensual se obtiene remuestreando esa serie en memoria después del caché.

### Binance no devuelve datos para una fecha

Binance tiene datos desde la fecha de listing de cada par. BTC-USD desde 2017-08-17, ETH-USD desde 2017-08-17, SOL-USD desde 2020-08-11. Rangos anteriores a esas fechas retornan error.

### Error de CORS en el frontend

Verificar que `ALLOWED_ORIGINS` en el `.env` del backend incluye `http://localhost:5173`.

### El gráfico no renderiza

Verificar en la consola del browser que `chart_data` no está vacío en la response del backend. Un rango de fechas con pocos datos (< 2 períodos) puede devolver `chart_data: []`.

### Datos incorrectos para crypto en fechas antiguas

La fuente es Binance; cada par tiene un `data_since` (listing) que coincide con lo documentado arriba. La serie guardada en caché empieza en esa fecha. Si `start_date` es anterior al primer dato pero `end_date` cae dentro del historial, el filtrado con pandas incluye velas desde la primera disponible en el rango, no desde `start_date` literal. Si el intervalo completo no cruza ninguna vela (por ejemplo `end_date` antes del listing de SOL), el backend devuelve error y el mensaje indica el rango de fechas con datos disponibles.

---

## Deploy

### Backend en Render

1. Crear un nuevo Web Service en Render
2. Conectar el repositorio de GitHub
3. Configurar:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Agregar variables de entorno:
   - `ALLOWED_ORIGINS=https://tu-app.vercel.app`
   - `CACHE_MAX_AGE_HOURS=24`
5. Agregar un **Disk** (persistent storage) montado en `/app/data/cache` para persistir el caché entre deploys

### Frontend en Vercel

1. Importar el repositorio en Vercel
2. Configurar:
   - **Root Directory:** `frontend`
   - **Framework:** Vite
3. Agregar variable de entorno:
   - `VITE_API_URL=https://tu-api.onrender.com`
4. Deploy automático en cada push a `main`
