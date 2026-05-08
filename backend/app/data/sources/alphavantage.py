from __future__ import annotations

import os
import time
from typing import Any

import pandas as pd
import requests

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
        raise ValueError(
            "Alpha Vantage indica límite de frecuencia (p. ej. 5 peticiones/minuto en el plan gratuito). "
            "Espera unos minutos o revisa tu cuota en alphavantage.co."
        )
    if "Information" in payload:
        info = str(payload["Information"])
        low = info.lower()
        if "premium" in low or "outputsize=full" in low or ("output size" in low and "full" in low):
            raise ValueError(
                "Alpha Vantage: con clave gratuita no está disponible outputsize=full en TIME_SERIES_DAILY "
                "(serie diaria de años). Para DCA diario con rangos largos hace falta un plan premium "
                "(alphavantage.co/premium/) o usa frecuencia semanal/mensual, que descargan series con historial "
                "largo sin ese límite."
            )
        raise ValueError(
            "Alpha Vantage devolvió un mensaje informativo (no serie de precios). "
            f"Detalle: {info[:400]}"
        )


def _parse_ohlcv_block(
    series_block: dict[Any, Any],
    *,
    symbol: str,
    ticker: str,
    series_label: str,
) -> pd.Series:
    idx: list[pd.Timestamp] = []
    vals: list[float] = []
    close_key = "4. close"
    for day_str, row in series_block.items():
        if not isinstance(row, dict) or close_key not in row:
            continue
        idx.append(pd.Timestamp(day_str))
        vals.append(float(row[close_key]))

    if not vals:
        raise ValueError(f"Serie vacía de Alpha Vantage ({series_label}) para {symbol!r}.")

    s = pd.Series(vals, index=pd.DatetimeIndex(idx, name="Date"), name=ticker)
    return s.astype(float).sort_index()


def fetch(*, symbol: str, ticker: str) -> pd.Series:
    """
    Precios de cierre diarios desde Alpha Vantage (TIME_SERIES_DAILY).

    El resampleo a weekly/monthly se hace en fetcher.py en memoria, evitando
    múltiples llamadas a la API y archivos de caché duplicados por frecuencia.

    NOTA sobre ALPHAVANTAGE_DAILY_OUTPUTSIZE: con ``compact`` (default en plan
    gratuito) solo se obtienen ~100 puntos de datos. Para historial completo se
    necesita ``full``, que requiere clave premium. Si el .env tiene
    ``ALPHAVANTAGE_DAILY_OUTPUTSIZE=compact``, la unificación de caché funciona
    correctamente pero la profundidad de datos queda limitada a ~100 días.
    """
    key = (os.getenv("ALPHAVANTAGE_API_KEY") or "").strip()
    if not key:
        raise ValueError(
            "Falta la variable de entorno ALPHAVANTAGE_API_KEY. "
            "Consigue una clave gratuita en https://www.alphavantage.co/support/#api-key "
            "y configúrala en el entorno o en backend/.env."
        )

    out = (os.getenv("ALPHAVANTAGE_DAILY_OUTPUTSIZE") or "compact").strip().lower()
    if out not in ("compact", "full"):
        out = "compact"

    params: dict[str, str] = {
        "function": "TIME_SERIES_DAILY",
        "symbol": symbol,
        "outputsize": out,
        "apikey": key,
    }
    block_key = "Time Series (Daily)"

    payload = _get_json_with_retry(params)
    _raise_if_av_root_messages(payload)

    if "Error Message" in payload:
        raise ValueError(
            f"Alpha Vantage rechazó la petición: {payload['Error Message']}"
        )

    series_block = payload.get(block_key)
    if not isinstance(series_block, dict) or not series_block:
        raise ValueError(
            f"No se pudo leer {block_key!r} de Alpha Vantage para {symbol!r}. "
            f"Claves en la respuesta: {list(payload.keys())!r}"
        )

    return _parse_ohlcv_block(series_block, symbol=symbol, ticker=ticker, series_label=block_key)
