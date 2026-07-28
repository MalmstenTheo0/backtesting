"""
Descarga de precios vía Binance (crypto) y Alpha Vantage (ETFs) con caché CSV local (Date, Close).
"""

from __future__ import annotations

import os
import threading
import time
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

from app.data.sources import alphavantage, binance
from app.exceptions import (
    InvalidDateRangeError,
    NoDataAvailableError,
    UnsupportedAssetTypeError,
    UnsupportedTickerError,
)

ASSETS: list[dict[str, Any]] = [
    {
        "ticker": "BTC-USD",
        "name": "Bitcoin",
        "type": "crypto",
        "binance_symbol": "BTCUSDT",
        "data_since": date(2017, 8, 17),
    },
    {
        "ticker": "ETH-USD",
        "name": "Ethereum",
        "type": "crypto",
        "binance_symbol": "ETHUSDT",
        "data_since": date(2017, 8, 17),
    },
    {
        "ticker": "SOL-USD",
        "name": "Solana",
        "type": "crypto",
        "binance_symbol": "SOLUSDT",
        "data_since": date(2020, 8, 11),
    },
    {
        "ticker": "SPY",
        "name": "S&P 500 ETF",
        "type": "etf",
        "data_since": date(1993, 1, 29),
    },
    {
        "ticker": "QQQ",
        "name": "Nasdaq 100 ETF",
        "type": "etf",
        "data_since": date(1999, 3, 10),
    },
    {
        "ticker": "VTI",
        "name": "Total Market ETF",
        "type": "etf",
        "data_since": date(2001, 6, 15),
    },
]


def get_assets() -> list[dict[str, Any]]:
    """Metadatos de activos para la API; `data_since` en ISO YYYY-MM-DD (sin `binance_symbol`)."""
    out: list[dict[str, Any]] = []
    for a in ASSETS:
        row = {k: v for k, v in a.items() if k != "binance_symbol"}
        ds = row.get("data_since")
        if isinstance(ds, date):
            row = {**row, "data_since": ds.isoformat()}
        out.append(row)
    return out


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _cache_dir_path() -> Path:
    raw = os.getenv("CACHE_DIR", "app/data/cache")
    p = Path(raw)
    if p.is_absolute():
        return p
    return (_backend_root() / p).resolve()


def _cache_max_age_hours() -> float:
    return float(os.getenv("CACHE_MAX_AGE_HOURS", "24"))


def _cache_is_fresh(cache_path: Path, max_age_hours: float) -> bool:
    age_seconds = time.time() - cache_path.stat().st_mtime
    return age_seconds < max_age_hours * 3600


_MAX_DATA_STALENESS_DAYS: dict[str, int] = {"crypto": 1, "etf": 7}


def _cache_needs_update(cache_path: Path, ticker_type: str) -> bool:
    """Decide si el caché necesita re-descarga considerando antigüedad y frescura de datos."""
    max_age_h = _cache_max_age_hours()
    if not _cache_is_fresh(cache_path, max_age_h):
        return True
    try:
        last_date = (
            pd.read_csv(cache_path, usecols=["Date"], parse_dates=["Date"])
            .iloc[-1]["Date"]
            .date()
        )
    except Exception:
        return True
    staleness = _MAX_DATA_STALENESS_DAYS.get(ticker_type, 3)
    return (date.today() - last_date).days > staleness


_ticker_locks: dict[str, threading.Lock] = {}
_ticker_locks_mutex = threading.Lock()


def _get_lock(cache_key: str) -> threading.Lock:
    with _ticker_locks_mutex:
        if cache_key not in _ticker_locks:
            _ticker_locks[cache_key] = threading.Lock()
        return _ticker_locks[cache_key]


def _read_cache_validated(path: Path) -> pd.DataFrame | None:
    """Lee el CSV cacheado y retorna None si está corrupto, vacío o le falta 'Close'."""
    try:
        df = pd.read_csv(path, index_col="Date", parse_dates=True)
    except Exception:
        return None
    if df.empty or "Close" not in df.columns:
        return None
    return df


def _resolve_asset(ticker: str) -> dict[str, Any]:
    for a in ASSETS:
        if a["ticker"] == ticker:
            return a
    allowed = ", ".join(sorted(x["ticker"] for x in ASSETS))
    raise UnsupportedTickerError(
        f"Ticker no soportado: {ticker!r}. Use uno de los siguientes: {allowed}."
    )


def _download_full_series(ticker: str, meta: dict[str, Any]) -> pd.Series:
    today = date.today()
    if meta["type"] == "crypto":
        return binance.fetch(
            binance_symbol=meta["binance_symbol"],
            ticker=ticker,
            data_since=meta["data_since"],
            end=today,
        )
    if meta["type"] == "etf":
        return alphavantage.fetch_weekly_adjusted(symbol=ticker, ticker=ticker)
    raise UnsupportedAssetTypeError(
        f"Tipo de activo no soportado para datos: {meta['type']!r}."
    )


def _cache_filename(ticker: str, meta: dict[str, Any]) -> str:
    """
    Crypto: ``TICKER.csv``. ETFs: siempre ``TIME_SERIES_WEEKLY_ADJUSTED`` → ``TICKER_wav.csv``.

    No depende de la frecuencia DCA: se cachea la serie completa de la fuente y el
    remuestreo se aplica en memoria al leerla.
    """
    if meta["type"] == "etf":
        return f"{ticker}_wav.csv"
    return f"{ticker}.csv"


def get_prices(
    ticker: str, start: date, end: date, *, dca_frequency: str = "daily"
) -> pd.Series:
    """
    Serie de cierre en el rango pedido.

    Crypto: Binance (velas diarias). ETFs: Alpha Vantage ``TIME_SERIES_WEEKLY_ADJUSTED``
    (plan gratuito, historial largo, cierre ajustado). Caché CSV (Date, Close).
    El resampleo a buckets DCA se aplica en memoria después de leer el caché.
    """
    if start > end:
        raise InvalidDateRangeError(
            f"Rango de fechas inválido: start ({start}) es posterior a end ({end})."
        )

    meta = _resolve_asset(ticker)

    cache_dir = _cache_dir_path()
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_name = _cache_filename(ticker, meta)
    cache_path = cache_dir / cache_name

    with _get_lock(cache_name):
        df: pd.DataFrame | None = None

        if cache_path.exists() and not _cache_needs_update(cache_path, meta["type"]):
            df = _read_cache_validated(cache_path)

        if df is None:
            raw = _download_full_series(ticker, meta)
            raw = raw.dropna()
            if raw.empty:
                raise NoDataAvailableError(
                    f"No se pudieron obtener datos para el ticker {ticker!r} "
                    "(respuesta vacía o rango inválido en la fuente)."
                )
            raw.rename_axis("Date").reset_index(name="Close").to_csv(
                cache_path, index=False
            )
            df = pd.read_csv(cache_path, index_col="Date", parse_dates=True)

    close = df["Close"].rename(ticker)

    close = close.astype(float).sort_index().dropna()
    if close.empty:
        raise NoDataAvailableError(
            f"No hay serie de precios válida para el ticker {ticker!r}."
        )

    ts_start = pd.Timestamp(start)
    ts_end = pd.Timestamp(end)
    window = close.loc[ts_start:ts_end]

    if dca_frequency == "weekly":
        filtered = window.resample("W-MON").first().dropna()
    elif dca_frequency == "monthly":
        filtered = window.resample("MS").first().dropna()
    else:
        filtered = window

    if filtered.empty:
        if window.empty:
            raise NoDataAvailableError(
                f"No hay datos de precios para {ticker!r} en el rango {start} -> {end}. "
                f"Datos disponibles: {close.index.min().date()} -> {close.index.max().date()}."
            )
        raise NoDataAvailableError(
            f"No hay datos de precios para {ticker!r} en el rango {start} -> {end} "
            f"con frecuencia DCA {dca_frequency!r}: la serie queda vacía tras el "
            f"remuestreo. Prueba a ampliar el rango de fechas o usar frecuencia diaria."
        )

    return filtered.astype(float).rename(ticker)