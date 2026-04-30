from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class Frequency(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


class StrategyName(str, Enum):
    dca = "dca"
    dca_weighted = "dca_weighted"
    value_averaging = "value_averaging"


class BacktestRequest(BaseModel):
    ticker: str
    amount_per_period: float = Field(..., ge=1.0)
    frequency: Frequency
    start_date: date
    end_date: date
    commission_pct: float = Field(default=0.0, ge=0.0, le=100.0)
    strategy: StrategyName = StrategyName.dca
