from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date

import pandas as pd


@dataclass
class BuyEvent:
    date: date
    price: float
    amount_invested: float
    commission_paid: float
    units_bought: float


@dataclass
class DailySnapshot:
    date: date
    price: float
    cumulative_invested: float
    portfolio_value: float
    is_buy: bool


@dataclass
class BacktestMetrics:
    total_invested: float
    total_commissions_paid: float
    final_value: float
    absolute_return: float
    return_pct: float
    cagr_pct: float
    total_units: float


@dataclass
class LumpSumComparison:
    capital: float
    units_bought: float
    final_value: float
    return_pct: float
    cagr_pct: float


@dataclass
class BacktestResult:
    metrics: BacktestMetrics
    lump_sum: LumpSumComparison
    chart_data: list[DailySnapshot]
    buy_events: list[BuyEvent]


class Strategy(ABC):
    """
    Clase base para todas las estrategias de inversión.
    """

    @abstractmethod
    def run(self, prices: pd.Series, params: dict) -> BacktestResult:
        ...

    def _calculate_lump_sum(
        self,
        prices: pd.Series,
        total_capital: float,
        commission_pct: float,
    ) -> LumpSumComparison:
        raise NotImplementedError

    def _get_period_dates(self, prices: pd.Series, frequency: str) -> pd.DatetimeIndex:
        raise NotImplementedError
