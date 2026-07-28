"""
Constructores de series de precios sintéticas para los tests.

Todas las series son deterministas y se arman en el test: nunca se leen datos reales de
mercado. El índice es siempre un ``DatetimeIndex`` tz-naive llamado ``Date``, igual al que
produce ``app.data.fetcher.get_prices``.
"""

from __future__ import annotations

from collections.abc import Sequence

import pandas as pd

DEFAULT_TICKER = "TEST"


def price_series(
    dates: Sequence[str],
    prices: Sequence[float],
    *,
    name: str = DEFAULT_TICKER,
) -> pd.Series:
    """Serie a partir de fechas y precios explícitos, uno a uno."""
    if len(dates) != len(prices):
        raise ValueError(
            f"dates y prices deben tener el mismo largo: {len(dates)} != {len(prices)}"
        )
    index = pd.DatetimeIndex([pd.Timestamp(d) for d in dates], name="Date")
    return pd.Series([float(p) for p in prices], index=index, name=name, dtype=float)


def constant_series(
    start: str,
    periods: int,
    *,
    price: float = 100.0,
    freq: str = "D",
    name: str = DEFAULT_TICKER,
) -> pd.Series:
    """Serie de precio constante. Útil cuando el precio no es la variable bajo test."""
    index = pd.date_range(start=start, periods=periods, freq=freq, name="Date")
    return pd.Series([float(price)] * periods, index=index, name=name, dtype=float)


def business_day_series(
    start: str,
    end: str,
    *,
    price: float = 100.0,
    name: str = DEFAULT_TICKER,
) -> pd.Series:
    """Serie sobre días hábiles (lun-vie), sin feriados. Para probar alineación de períodos."""
    index = pd.bdate_range(start=start, end=end, name="Date")
    return pd.Series([float(price)] * len(index), index=index, name=name, dtype=float)


def empty_series(*, name: str = DEFAULT_TICKER) -> pd.Series:
    """Serie vacía con el mismo tipo de índice que una serie real."""
    return pd.Series(
        [], index=pd.DatetimeIndex([], name="Date"), name=name, dtype=float
    )
