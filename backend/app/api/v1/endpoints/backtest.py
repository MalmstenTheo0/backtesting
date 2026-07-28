from fastapi import APIRouter, HTTPException, status

from app.constants import CURATED_TICKERS
from app.data.fetcher import get_prices
from app.models.request import BacktestRequest
from app.models.response import (
    BacktestMetrics as BacktestMetricsResponse,
)
from app.models.response import (
    BacktestResponse,
    BacktestSummary,
    ChartPoint,
    LumpSumMetrics,
)
from app.strategies.base import BacktestResult
from app.strategies.registry import get_strategy

router = APIRouter()

_500_DETAIL = "Internal server error. Please try again."


def _to_http(e: ValueError) -> HTTPException:
    """
    Traduce un error de dominio al status code que declara su propia clase.

    Antes esto clasificaba buscando substrings en el mensaje ("rango", "mínimo",
    "no disponible"). Era frágil —retocar el texto de un error movía su status
    code— y además la mayoría de esas ramas no hacía nada: todas terminaban en
    422, igual que el fallback.

    Un `ValueError` sin tipar se trata como error de validación: es el mismo
    comportamiento que tenía el fallback anterior.
    """
    http_status = getattr(e, "http_status", status.HTTP_422_UNPROCESSABLE_ENTITY)
    return HTTPException(status_code=http_status, detail=str(e))


def _request_to_params(body: BacktestRequest) -> dict:
    return {
        "amount_per_period": body.amount_per_period,
        "frequency": body.frequency.value,
        "commission_pct": body.commission_pct,
    }


def _backtest_result_to_response(
    body: BacktestRequest, resolved_ticker: str, result: BacktestResult
) -> BacktestResponse:
    summary = BacktestSummary(
        ticker=resolved_ticker,
        strategy=body.strategy.value,
        frequency=body.frequency.value,
        start_date=body.start_date,
        end_date=body.end_date,
        total_periods=len(result.buy_events),
        amount_per_period=body.amount_per_period,
        commission_pct=body.commission_pct,
    )
    m = result.metrics
    metrics = BacktestMetricsResponse(
        total_invested=m.total_invested,
        total_commissions_paid=m.total_commissions_paid,
        final_value=m.final_value,
        absolute_return=m.absolute_return,
        return_pct=m.return_pct,
        cagr_pct=m.cagr_pct,
        total_units=m.total_units,
    )
    ls = result.lump_sum
    lump_sum = LumpSumMetrics(
        capital=ls.capital,
        units_bought=ls.units_bought,
        final_value=ls.final_value,
        return_pct=ls.return_pct,
        cagr_pct=ls.cagr_pct,
    )
    chart_data = [
        ChartPoint(
            date=s.date,
            price=s.price,
            invested=s.cumulative_invested,
            portfolio_value=s.portfolio_value,
            is_buy=s.is_buy,
        )
        for s in result.chart_data
    ]
    return BacktestResponse(
        summary=summary,
        metrics=metrics,
        lump_sum=lump_sum,
        chart_data=chart_data,
    )


@router.post("", response_model=BacktestResponse)
def run_backtest(body: BacktestRequest) -> BacktestResponse:
    ticker = body.ticker.strip().upper()
    if ticker not in CURATED_TICKERS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Ticker no permitido: {body.ticker!r}. Debe estar en la lista curada de activos."
            ),
        )

    try:
        prices = get_prices(
            ticker, body.start_date, body.end_date, dca_frequency=body.frequency.value
        )
    except ValueError as e:
        raise _to_http(e) from e

    try:
        strategy = get_strategy(body.strategy.value)
    except ValueError as e:
        raise _to_http(e) from e

    try:
        params = _request_to_params(body)
        result = strategy.run(prices, params)
        return _backtest_result_to_response(body, ticker, result)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_500_DETAIL,
        ) from None
