import pandas as pd

from app.strategies.base import BacktestResult, Strategy


class DCAStrategy(Strategy):
    """Dollar Cost Averaging tradicional."""

    def run(self, prices: pd.Series, params: dict) -> BacktestResult:
        raise NotImplementedError
