from datetime import date
from enum import Enum

from pydantic import BaseModel, Field, model_validator
from typing_extensions import Self

from app.data.fetcher import ASSETS


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

    @model_validator(mode="after")
    def validate_dates_range_and_etf_daily(self) -> Self:
        if self.start_date >= self.end_date:
            raise ValueError("start_date debe ser anterior a end_date")
        if (self.end_date - self.start_date).days < 30:
            raise ValueError("El rango mínimo es 30 días")

        tick = self.ticker.strip().upper()
        if self.frequency == Frequency.daily:
            for a in ASSETS:
                if a["ticker"] == tick and a["type"] == "etf":
                    raise ValueError(
                        "La frecuencia diaria no está disponible para ETFs en el plan gratuito. "
                        "Usá frecuencia semanal o mensual."
                    )
        return self
