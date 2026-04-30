"""
Descarga de precios vía yfinance con caché CSV local (ver docs/ARCHITECTURE.md).
"""

from __future__ import annotations

import os
import time
from datetime import date
from pathlib import Path

import pandas as pd
import yfinance as yf
from dotenv import load_dotenv

load_dotenv()


def _backend_root() -> Path:
    # fetcher.py -> app/data -> app -> backend
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


def _flatten_ohlcv_columns(df: pd.DataFrame) -> pd.DataFrame:
    """yfinance usa columnas MultiIndex; al guardar CSV conviene una sola fila de cabecera."""
    out = df.copy()
    if isinstance(out.columns, pd.MultiIndex):
        out.columns = out.columns.droplevel(-1)
    return out


def _read_first_line(path: Path) -> str:
    with path.open("r", encoding="utf-8") as f:
        return f.readline()


def _read_cached_ohlcv(path: Path) -> pd.DataFrame:
    """
    Lee CSV de caché. Compatibilidad: yfinance antiguo escribía varias filas de cabecera
    (empieza con 'Price,'); el formato normalizado es una sola cabecera + índice Date.
    """
    first = _read_first_line(path)
    if first.startswith("Price,"):
        df = pd.read_csv(path, header=[0, 1], index_col=0)
        df.index = pd.to_datetime(df.index, errors="coerce")
        df = df[df.index.notna()]
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(-1)
        return df
    return pd.read_csv(path, index_col=0, parse_dates=True)


def _close_series_from_ohlcv(df: pd.DataFrame) -> pd.Series:
    if df.empty:
        raise ValueError("El DataFrame de precios está vacío.")
    close = df["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    s = pd.Series(close, copy=True)
    s.index = pd.to_datetime(s.index)
    s = s.astype(float).sort_index()
    return s


def get_prices(ticker: str, start: date, end: date) -> pd.Series:
    """
    Obtiene la serie de precios de cierre ajustados para el ticker en el rango dado.

    Usa caché en CSV si existe y no está vencido; si no, descarga con yfinance
    y guarda el resultado completo (period=max).
    """
    if start > end:
        raise ValueError(
            f"Rango de fechas inválido: start ({start}) es posterior a end ({end})."
        )

    cache_dir = _cache_dir_path()
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{ticker}.csv"
    max_age_h = _cache_max_age_hours()

    use_cache = cache_path.exists() and _cache_is_fresh(cache_path, max_age_h)

    if use_cache:
        df = _read_cached_ohlcv(cache_path)
    else:
        df = yf.download(
            ticker,
            period="max",
            auto_adjust=True,
            progress=False,
        )
        if df.empty:
            raise ValueError(
                f"No se pudieron obtener datos de Yahoo Finance para el ticker {ticker!r} "
                "(respuesta vacía o ticker inválido)."
            )
        to_store = _flatten_ohlcv_columns(df)
        to_store.index.name = "Date"
        to_store.to_csv(cache_path)

    close = _close_series_from_ohlcv(df)
    close = close.dropna()
    if close.empty:
        raise ValueError(f"No hay serie de precios válida para el ticker {ticker!r}.")

    ts_start = pd.Timestamp(start)
    ts_end = pd.Timestamp(end)
    filtered = close.loc[ts_start:ts_end]

    if filtered.empty:
        raise ValueError(
            f"No hay datos de precios para {ticker!r} en el rango {start} -> {end}. "
            f"Datos disponibles: {close.index.min().date()} -> {close.index.max().date()}."
        )

    return filtered.astype(float)
