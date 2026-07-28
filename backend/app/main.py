import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.router import api_router

load_dotenv()

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173",
).split(",")

app = FastAPI(title="DCA Backtester API", version="0.1.0")

# `chart_data` lleva un punto por día de cotización, así que un backtest largo ronda
# los 190 KB de JSON muy repetitivo. Comprimido baja a ~14 KB.
# Se registra antes que CORS a propósito: en Starlette el último middleware agregado
# queda en la capa exterior, y conviene que CORS sea el de afuera para que sus headers
# también estén presentes en las respuestas de error.
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "DCA Backtester API"}
