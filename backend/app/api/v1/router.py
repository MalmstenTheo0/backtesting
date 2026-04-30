from fastapi import APIRouter

from app.api.v1.endpoints import assets, backtest, health

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])
api_router.include_router(backtest.router, prefix="/backtest", tags=["backtest"])
