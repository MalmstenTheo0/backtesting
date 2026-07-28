from __future__ import annotations

import time
from datetime import UTC, date, datetime

import pandas as pd
import requests

from app.exceptions import UpstreamResponseError

BINANCE_KLINES_URL = "https://api.binance.com/api/v3/klines"
DAY_MS = 86_400_000
MAX_RETRIES = 3


def _date_start_ms_utc(d: date) -> int:
    return int(datetime(d.year, d.month, d.day, tzinfo=UTC).timestamp() * 1000)


def _now_ms_utc() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


def _get_json_with_retry(params: dict) -> list:
    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.get(
                BINANCE_KLINES_URL,
                params=params,
                timeout=60,
            )
            r.raise_for_status()
            data = r.json()
            if isinstance(data, dict) and "code" in data:
                raise UpstreamResponseError(
                    f"Binance API error: {data.get('msg', data)!r} (code={data.get('code')})"
                )
            if not isinstance(data, list):
                raise UpstreamResponseError(
                    f"Respuesta inesperada de Binance: {type(data).__name__}"
                )
            return data
        except ValueError:
            raise
        except requests.RequestException as e:
            last_exc = e
            if attempt < MAX_RETRIES - 1:
                time.sleep(2**attempt)
    assert last_exc is not None
    raise last_exc


def fetch(
    *,
    binance_symbol: str,
    ticker: str,
    data_since: date,
    end: date,
) -> pd.Series:
    """
    Descarga velas diarias (close) desde Binance público.

    Pagina en bloques de hasta 1000 velas. Índice DatetimeIndex tz-naive (UTC calendar dates).
    """
    end_ms = min(_date_start_ms_utc(end) + DAY_MS - 1, _now_ms_utc())
    start_ms = _date_start_ms_utc(data_since)
    if start_ms > end_ms:
        return pd.Series(dtype=float, name=ticker)

    rows: list[list] = []
    cursor = start_ms

    while cursor <= end_ms:
        chunk = _get_json_with_retry(
            {
                "symbol": binance_symbol,
                "interval": "1d",
                "startTime": cursor,
                "endTime": end_ms,
                "limit": 1000,
            }
        )
        if not chunk:
            break
        rows.extend(chunk)
        last_open = int(chunk[-1][0])
        if len(chunk) < 1000:
            break
        cursor = last_open + DAY_MS
        if cursor <= last_open:
            break

    if not rows:
        return pd.Series(dtype=float, name=ticker)

    # Dedupe by open time (ms) keeping order
    seen: set[int] = set()
    unique_rows: list[list] = []
    for row in rows:
        o = int(row[0])
        if o not in seen:
            seen.add(o)
            unique_rows.append(row)

    idx = []
    vals = []
    for row in sorted(unique_rows, key=lambda x: int(x[0])):
        ts_ms = int(row[0])
        dt = datetime.fromtimestamp(ts_ms / 1000.0, tz=UTC).replace(tzinfo=None)
        idx.append(dt)
        vals.append(float(row[4]))

    s = pd.Series(vals, index=pd.DatetimeIndex(idx, name="Date"), name=ticker)
    s = s.astype(float).sort_index()
    # Un solo punto por día (por si acaso)
    s = s[~s.index.duplicated(keep="last")]
    return s
