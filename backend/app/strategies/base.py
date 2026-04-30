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
        """
        Helper compartido por todas las estrategias para calcular el lump sum.
        Puede sobreescribirse si la estrategia necesita una comparación diferente.
        """
        first_price = prices.iloc[0]
        last_price = prices.iloc[-1]
        commission = total_capital * (commission_pct / 100)
        units = (total_capital - commission) / first_price
        final_value = units * last_price
        return_pct = ((final_value - total_capital) / total_capital) * 100
        years = (prices.index[-1] - prices.index[0]).days / 365.25
        cagr = (
            ((final_value / total_capital) ** (1 / years) - 1) * 100
            if years > 0
            else 0
        )

        return LumpSumComparison(
            capital=round(total_capital, 2),
            units_bought=round(units, 6),
            final_value=round(final_value, 2),
            return_pct=round(return_pct, 2),
            cagr_pct=round(cagr, 2),
        )

    def _get_period_dates(self, prices: pd.Series, frequency: str) -> pd.DatetimeIndex:
        """
        Helper para obtener las fechas de compra según la frecuencia.
        Retorna las fechas del índice de prices que corresponden a cada período.
        """
        if frequency == "daily":
            return prices.index
        if frequency == "weekly":
            return prices.resample("W-MON").first().dropna().index
        if frequency == "monthly":
            return prices.resample("MS").first().dropna().index
        raise ValueError(f"Frecuencia no soportada: {frequency}")
