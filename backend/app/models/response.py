from datetime import date
from enum import Enum

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: str = "ok"


class AssetType(str, Enum):
    crypto = "crypto"
    etf = "etf"
    stock = "stock"


class AssetItem(BaseModel):
    ticker: str
    name: str
    type: AssetType
    data_since: date


class AssetsResponse(BaseModel):
    assets: list[AssetItem]


class BacktestSummary(BaseModel):
    ticker: str
    strategy: str
    frequency: str
    start_date: date
    end_date: date
    total_periods: int
    amount_per_period: float
    commission_pct: float


class BacktestMetrics(BaseModel):
    total_invested: float
    total_commissions_paid: float
    final_value: float
    absolute_return: float
    return_pct: float
    cagr_pct: float
    total_units: float


class LumpSumMetrics(BaseModel):
    capital: float
    units_bought: float
    final_value: float
    return_pct: float
    cagr_pct: float


class ChartPoint(BaseModel):
    """`invested` en JSON; acepta `cumulative_invested` al construir desde DailySnapshot."""

    model_config = ConfigDict(populate_by_name=True)

    date: date
    price: float
    invested: float = Field(
        validation_alias=AliasChoices("invested", "cumulative_invested"),
    )
    portfolio_value: float
    is_buy: bool


class BacktestResponse(BaseModel):
    summary: BacktestSummary
    metrics: BacktestMetrics
    lump_sum: LumpSumMetrics
    chart_data: list[ChartPoint] = Field(default_factory=list)
