from datetime import date

import pandas as pd


def get_prices(ticker: str, start: date, end: date) -> pd.Series:
    """
    Obtiene la serie de precios de cierre ajustados para el ticker en el rango dado.
    """
    raise NotImplementedError
