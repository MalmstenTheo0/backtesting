from fastapi import APIRouter, HTTPException, status

from app.models.request import BacktestRequest
from app.models.response import BacktestResponse

router = APIRouter()


@router.post("", response_model=BacktestResponse)
def run_backtest(_body: BacktestRequest) -> BacktestResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Backtest not implemented yet.",
    )
