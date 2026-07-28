"""
Tests de `app.data.fetcher`: política de caché y lectura defensiva del CSV.

Las fuentes (`binance.fetch` y `alphavantage.fetch_weekly_adjusted`) se reemplazan por
espías que cuentan llamadas, así se puede afirmar *que no se descargó nada* — que es la
mitad interesante de un caché. La fixture `block_network` de conftest.py garantiza que
ningún test se escape a la red aunque el mockeo falle.
"""

from __future__ import annotations

import os
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from app.constants import CURATED_TICKERS
from app.data import fetcher
from app.data.sources import alphavantage, binance


class SourceSpy:
    """Reemplaza a una fuente de datos y cuenta cuántas veces la llamaron."""

    def __init__(self, series: pd.Series) -> None:
        self.series = series
        self.calls = 0

    def __call__(self, **kwargs: Any) -> pd.Series:
        self.calls += 1
        return self.series


def series_hasta_hoy(
    *, dias: int = 40, precio: float = 1.0, ultimo_dia: date | None = None
) -> pd.Series:
    """Serie diaria que termina en `ultimo_dia` (por defecto, hoy)."""
    fin = ultimo_dia or date.today()
    index = pd.date_range(end=pd.Timestamp(fin), periods=dias, freq="D", name="Date")
    return pd.Series([precio] * dias, index=index, name="TEST", dtype=float)


def semanas_hasta_hoy(
    *, semanas: int = 30, precio: float = 1.0, ultimo_dia: date | None = None
) -> pd.Series:
    """Serie semanal (viernes), como la que devuelve Alpha Vantage para ETFs."""
    fin = ultimo_dia or date.today()
    index = pd.date_range(end=pd.Timestamp(fin), periods=semanas, freq="7D", name="Date")
    return pd.Series([precio] * semanas, index=index, name="TEST", dtype=float)


def escribir_cache(
    path: Path, serie: pd.Series, *, antiguedad_horas: float = 0.0
) -> None:
    """Siembra un CSV de caché con el formato real (Date, Close) y una mtime dada."""
    serie.rename_axis("Date").reset_index(name="Close").to_csv(path, index=False)
    if antiguedad_horas:
        momento = time.time() - antiguedad_horas * 3600
        os.utime(path, (momento, momento))


@pytest.fixture
def binance_spy(monkeypatch: pytest.MonkeyPatch) -> SourceSpy:
    spy = SourceSpy(series_hasta_hoy(precio=2.0))
    monkeypatch.setattr(binance, "fetch", spy)
    return spy


@pytest.fixture
def alphavantage_spy(monkeypatch: pytest.MonkeyPatch) -> SourceSpy:
    spy = SourceSpy(semanas_hasta_hoy(precio=2.0))
    monkeypatch.setattr(alphavantage, "fetch_weekly_adjusted", spy)
    return spy


class TestCacheFresco:
    def test_no_descarga_si_el_cache_esta_fresco(
        self, cache_dir: Path, binance_spy: SourceSpy
    ) -> None:
        escribir_cache(cache_dir / "BTC-USD.csv", series_hasta_hoy(precio=1.0))

        resultado = fetcher.get_prices(
            "BTC-USD", date.today() - timedelta(days=30), date.today()
        )

        assert binance_spy.calls == 0
        assert set(resultado.unique()) == {1.0}  # el precio del caché, no el de la fuente

    def test_un_etf_tolera_datos_de_hasta_una_semana(
        self, cache_dir: Path, alphavantage_spy: SourceSpy
    ) -> None:
        # _MAX_DATA_STALENESS_DAYS["etf"] == 7: un ETF con el ultimo cierre hace 3 dias
        # sigue siendo valido (no cotiza fines de semana ni feriados).
        escribir_cache(
            cache_dir / "SPY_wav.csv",
            semanas_hasta_hoy(precio=1.0, ultimo_dia=date.today() - timedelta(days=3)),
        )

        fetcher.get_prices(
            "SPY",
            date.today() - timedelta(days=120),
            date.today(),
            dca_frequency="weekly",
        )

        assert alphavantage_spy.calls == 0


class TestInvalidacionDeCache:
    def test_redescarga_si_el_archivo_supera_cache_max_age_hours(
        self, cache_dir: Path, binance_spy: SourceSpy, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("CACHE_MAX_AGE_HOURS", "24")
        escribir_cache(
            cache_dir / "BTC-USD.csv",
            series_hasta_hoy(precio=1.0),
            antiguedad_horas=48,
        )

        resultado = fetcher.get_prices(
            "BTC-USD", date.today() - timedelta(days=30), date.today()
        )

        assert binance_spy.calls == 1
        assert set(resultado.unique()) == {2.0}  # el precio nuevo, de la fuente

    def test_cache_max_age_hours_es_configurable(
        self, cache_dir: Path, binance_spy: SourceSpy, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Con una ventana mas amplia, el mismo archivo de 48 h pasa a ser fresco.
        monkeypatch.setenv("CACHE_MAX_AGE_HOURS", "72")
        escribir_cache(
            cache_dir / "BTC-USD.csv",
            series_hasta_hoy(precio=1.0),
            antiguedad_horas=48,
        )

        fetcher.get_prices("BTC-USD", date.today() - timedelta(days=30), date.today())

        assert binance_spy.calls == 0

    def test_redescarga_si_el_ultimo_dato_quedo_viejo_aunque_el_archivo_sea_reciente(
        self, cache_dir: Path, binance_spy: SourceSpy
    ) -> None:
        # Archivo escrito recien (mtime fresca) pero con datos que terminan hace 10 dias.
        # Para cripto la tolerancia es 1 dia, asi que hay que volver a bajar.
        escribir_cache(
            cache_dir / "BTC-USD.csv",
            series_hasta_hoy(precio=1.0, ultimo_dia=date.today() - timedelta(days=10)),
        )

        fetcher.get_prices("BTC-USD", date.today() - timedelta(days=30), date.today())

        assert binance_spy.calls == 1

    def test_un_etf_con_datos_de_mas_de_una_semana_se_redescarga(
        self, cache_dir: Path, alphavantage_spy: SourceSpy
    ) -> None:
        escribir_cache(
            cache_dir / "SPY_wav.csv",
            semanas_hasta_hoy(precio=1.0, ultimo_dia=date.today() - timedelta(days=10)),
        )

        fetcher.get_prices(
            "SPY",
            date.today() - timedelta(days=120),
            date.today(),
            dca_frequency="weekly",
        )

        assert alphavantage_spy.calls == 1

    def test_sin_archivo_de_cache_descarga_y_lo_persiste(
        self, cache_dir: Path, binance_spy: SourceSpy
    ) -> None:
        assert not (cache_dir / "BTC-USD.csv").exists()

        fetcher.get_prices("BTC-USD", date.today() - timedelta(days=30), date.today())

        assert binance_spy.calls == 1
        assert (cache_dir / "BTC-USD.csv").exists()


class TestLecturaDefensivaDelCSV:
    """`_read_cache_validated` tiene que devolver None ante cualquier CSV inservible."""

    def test_archivo_vacio(self, tmp_path: Path) -> None:
        path = tmp_path / "vacio.csv"
        path.write_text("", encoding="utf-8")

        assert fetcher._read_cache_validated(path) is None

    def test_archivo_con_basura(self, tmp_path: Path) -> None:
        path = tmp_path / "basura.csv"
        path.write_text("esto no es un csv\x00\x01", encoding="utf-8")

        assert fetcher._read_cache_validated(path) is None

    def test_csv_sin_columna_close(self, tmp_path: Path) -> None:
        path = tmp_path / "sin_close.csv"
        path.write_text("Date,Open\n2024-01-01,10\n", encoding="utf-8")

        assert fetcher._read_cache_validated(path) is None

    def test_csv_sin_filas(self, tmp_path: Path) -> None:
        path = tmp_path / "sin_filas.csv"
        path.write_text("Date,Close\n", encoding="utf-8")

        assert fetcher._read_cache_validated(path) is None

    def test_csv_valido_se_lee(self, tmp_path: Path) -> None:
        path = tmp_path / "ok.csv"
        path.write_text("Date,Close\n2024-01-01,10.5\n", encoding="utf-8")

        df = fetcher._read_cache_validated(path)

        assert df is not None
        assert df["Close"].tolist() == [10.5]

    def test_un_cache_ilegible_dispara_la_redescarga(
        self, cache_dir: Path, binance_spy: SourceSpy
    ) -> None:
        # Fechas validas y recientes (pasa el chequeo de antiguedad) pero sin columna
        # Close: el fallo tiene que detectarse al validar, no al calcular.
        fechas = pd.date_range(end=pd.Timestamp(date.today()), periods=5, freq="D")
        pd.DataFrame({"Date": fechas, "Open": [1.0] * 5}).to_csv(
            cache_dir / "BTC-USD.csv", index=False
        )

        resultado = fetcher.get_prices(
            "BTC-USD", date.today() - timedelta(days=30), date.today()
        )

        assert binance_spy.calls == 1
        assert set(resultado.unique()) == {2.0}


class TestNombreDeArchivoDeCache:
    def test_cripto_usa_el_ticker_pelado(
        self, cache_dir: Path, binance_spy: SourceSpy
    ) -> None:
        fetcher.get_prices("BTC-USD", date.today() - timedelta(days=30), date.today())

        assert [p.name for p in cache_dir.iterdir()] == ["BTC-USD.csv"]

    def test_los_etf_usan_el_sufijo_wav(
        self, cache_dir: Path, alphavantage_spy: SourceSpy
    ) -> None:
        # Siempre TIME_SERIES_WEEKLY_ADJUSTED, independientemente de la frecuencia DCA.
        fetcher.get_prices(
            "SPY",
            date.today() - timedelta(days=120),
            date.today(),
            dca_frequency="monthly",
        )

        assert [p.name for p in cache_dir.iterdir()] == ["SPY_wav.csv"]

    def test_la_frecuencia_dca_no_cambia_el_archivo_de_cache(
        self, cache_dir: Path, alphavantage_spy: SourceSpy
    ) -> None:
        for frecuencia in ("weekly", "monthly"):
            fetcher.get_prices(
                "SPY",
                date.today() - timedelta(days=120),
                date.today(),
                dca_frequency=frecuencia,
            )

        assert [p.name for p in cache_dir.iterdir()] == ["SPY_wav.csv"]


class TestErrores:
    def test_start_posterior_a_end(self, cache_dir: Path) -> None:
        with pytest.raises(ValueError, match="Rango de fechas inválido"):
            fetcher.get_prices("BTC-USD", date(2024, 6, 1), date(2024, 1, 1))

    def test_ticker_fuera_de_la_lista_de_activos(self, cache_dir: Path) -> None:
        with pytest.raises(ValueError, match="Ticker no soportado"):
            fetcher.get_prices("DOGE-USD", date(2024, 1, 1), date(2024, 6, 1))

    def test_el_error_de_ticker_enumera_los_validos(self, cache_dir: Path) -> None:
        with pytest.raises(ValueError, match="BTC-USD"):
            fetcher.get_prices("DOGE-USD", date(2024, 1, 1), date(2024, 6, 1))

    def test_fuente_que_devuelve_serie_vacia(
        self, cache_dir: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        vacia = pd.Series(
            [], index=pd.DatetimeIndex([], name="Date"), name="TEST", dtype=float
        )
        monkeypatch.setattr(binance, "fetch", SourceSpy(vacia))

        with pytest.raises(ValueError, match="No se pudieron obtener datos"):
            fetcher.get_prices(
                "BTC-USD", date.today() - timedelta(days=30), date.today()
            )

    def test_rango_sin_datos_informa_el_rango_disponible(
        self, cache_dir: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        index = pd.date_range("2020-01-01", periods=30, freq="D", name="Date")
        historica = pd.Series([1.0] * 30, index=index, name="TEST", dtype=float)
        monkeypatch.setattr(binance, "fetch", SourceSpy(historica))

        with pytest.raises(ValueError, match="Datos disponibles: 2020-01-01"):
            fetcher.get_prices("BTC-USD", date(2023, 1, 1), date(2023, 6, 1))


class TestMetadatosDeActivos:
    def test_get_assets_coincide_con_la_lista_curada(self) -> None:
        tickers = {a["ticker"] for a in fetcher.get_assets()}

        assert tickers == set(CURATED_TICKERS)

    def test_get_assets_no_filtra_el_simbolo_interno_de_binance(self) -> None:
        assert all("binance_symbol" not in a for a in fetcher.get_assets())

    def test_get_assets_serializa_data_since_como_iso(self) -> None:
        btc = next(a for a in fetcher.get_assets() if a["ticker"] == "BTC-USD")

        assert btc["data_since"] == "2017-08-17"
