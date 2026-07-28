from __future__ import annotations

import os
import time
from typing import Any

import pandas as pd
import requests

from app.exceptions import (
    UpstreamConfigError,
    UpstreamRateLimitError,
    UpstreamResponseError,
)

ALPHAVANTAGE_URL = "https://www.alphavantage.co/query"
MAX_RETRIES = 3


def _get_json_with_retry(params: dict[str, str]) -> dict[str, Any]:
    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.get(ALPHAVANTAGE_URL, params=params, timeout=120)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            last_exc = e
            if attempt < MAX_RETRIES - 1:
                time.sleep(2**attempt)
    assert last_exc is not None
    raise last_exc


def _raise_if_av_root_messages(payload: Any) -> None:
    if not isinstance(payload, dict):
        return
    if "Note" in payload:
        raise UpstreamRateLimitError(
            "Alpha Vantage indica límite de frecuencia "
            "(p. ej. 5 peticiones/minuto en el plan gratuito). "
            "Espera unos minutos o revisa tu cuota en alphavantage.co."
        )
    if "Information" in payload:
        info = str(payload["Information"])
        low = info.lower()
        if "premium" in low or "outputsize=full" in low or ("output size" in low and "full" in low):
            raise UpstreamConfigError(
                "Alpha Vantage: respuesta de plan premium requerida. "
                "Verificá que ALPHAVANTAGE_API_KEY en .env sea válida y activa."
            )
        raise UpstreamResponseError(
            "Alpha Vantage devolvió un mensaje informativo (no serie de precios). "
            f"Detalle: {info[:400]}"
        )


def _parse_ohlcv_block(
    series_block: dict[Any, Any],
    *,
    symbol: str,
    ticker: str,
    series_label: str,
    close_key: str,
) -> pd.Series:
    idx: list[pd.Timestamp] = []
    vals: list[float] = []
    for day_str, row in series_block.items():
        if not isinstance(row, dict) or close_key not in row:
            continue
        idx.append(pd.Timestamp(day_str))
        vals.append(float(row[close_key]))

    if not vals:
        raise UpstreamResponseError(
            f"Serie vacía de Alpha Vantage ({series_label}) para {symbol!r}."
        )

    s = pd.Series(vals, index=pd.DatetimeIndex(idx, name="Date"), name=ticker)
    return s.astype(float).sort_index()


def fetch_weekly_adjusted(*, symbol: str, ticker: str) -> pd.Series:
    """
    Cierre semanal ajustado (TIME_SERIES_WEEKLY_ADJUSTED).

    En plan gratuito suele devolver décadas de historia en una sola petición.
    """
    key = (os.getenv("ALPHAVANTAGE_API_KEY") or "").strip()
    if not key:
        raise UpstreamConfigError(
            "Falta la variable de entorno ALPHAVANTAGE_API_KEY. "
            "Consigue una clave gratuita en https://www.alphavantage.co/support/#api-key "
            "y configúrala en el entorno o en backend/.env."
        )

    params: dict[str, str] = {
        "function": "TIME_SERIES_WEEKLY_ADJUSTED",
        "symbol": symbol,
        "apikey": key,
    }
    block_key = "Weekly Adjusted Time Series"

    payload = _get_json_with_retry(params)
    _raise_if_av_root_messages(payload)

    if "Error Message" in payload:
        raise UpstreamResponseError(
            f"Alpha Vantage rechazó la petición: {payload['Error Message']}"
        )

    series_block = payload.get(block_key)
    if not isinstance(series_block, dict) or not series_block:
        raise UpstreamResponseError(
            f"No se pudo leer {block_key!r} de Alpha Vantage para {symbol!r}. "
            f"Claves en la respuesta: {list(payload.keys())!r}"
        )

    return _parse_ohlcv_block(
        series_block,
        symbol=symbol,
        ticker=ticker,
        series_label=block_key,
        close_key="5. adjusted close",
    )
