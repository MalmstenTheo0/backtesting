"""
Tests de `POST /api/v1/backtest` (más health y assets).

`get_prices` está mockeado en todos los casos: acá se prueba la capa HTTP —validación
del body, traducción de errores a status codes y forma de la respuesta—, no el acceso
a datos, que ya cubre test_fetcher.py.

`TestMapeoDeErroresAStatusCode` es el contrato congelado: enumera cada ValueError que
`get_prices` puede levantar con el status que produce **hoy**. Es la red de seguridad
del refactor a excepciones tipadas; si ese refactor cambia algún código, esta tabla lo
detecta.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints import backtest as backtest_endpoint
from app.exceptions import (
    BacktestError,
    InvalidDateRangeError,
    NoDataAvailableError,
    UnsupportedAssetTypeError,
    UnsupportedTickerError,
    UpstreamConfigError,
    UpstreamRateLimitError,
    UpstreamResponseError,
)
from app.main import app

BACKTEST_URL = "/api/v1/backtest"


def request_body(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "ticker": "BTC-USD",
        "amount_per_period": 100.0,
        "frequency": "daily",
        "start_date": "2020-01-01",
        "end_date": "2020-12-31",
        "commission_pct": 0.0,
        "strategy": "dca",
    }
    payload.update(overrides)
    return payload


def serie_de_precios(dias: int = 60, precio: float = 100.0) -> pd.Series:
    index = pd.date_range("2020-01-01", periods=dias, freq="D", name="Date")
    return pd.Series([precio] * dias, index=index, name="BTC-USD", dtype=float)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def precios_mockeados(monkeypatch: pytest.MonkeyPatch) -> pd.Series:
    """Por defecto `get_prices` devuelve una serie sintética y no toca datos reales."""
    serie = serie_de_precios()
    monkeypatch.setattr(backtest_endpoint, "get_prices", lambda *args, **kwargs: serie)
    return serie


@pytest.fixture
def get_prices_que_falla(
    monkeypatch: pytest.MonkeyPatch,
) -> Callable[[Exception], None]:
    def _configurar(exc: Exception) -> None:
        def _levantar(*args: Any, **kwargs: Any) -> pd.Series:
            raise exc

        monkeypatch.setattr(backtest_endpoint, "get_prices", _levantar)

    return _configurar


class TestHappyPath:
    def test_devuelve_200_con_las_cuatro_secciones(self, client: TestClient) -> None:
        respuesta = client.post(BACKTEST_URL, json=request_body())

        assert respuesta.status_code == 200
        assert set(respuesta.json()) == {
            "summary",
            "metrics",
            "lump_sum",
            "chart_data",
        }

    def test_el_summary_refleja_lo_pedido(self, client: TestClient) -> None:
        respuesta = client.post(BACKTEST_URL, json=request_body())

        summary = respuesta.json()["summary"]
        assert summary["ticker"] == "BTC-USD"
        assert summary["strategy"] == "dca"
        assert summary["frequency"] == "daily"
        assert summary["start_date"] == "2020-01-01"
        assert summary["amount_per_period"] == 100.0

    def test_total_periods_es_la_cantidad_de_compras(
        self, client: TestClient, precios_mockeados: pd.Series
    ) -> None:
        respuesta = client.post(BACKTEST_URL, json=request_body())

        assert respuesta.json()["summary"]["total_periods"] == len(precios_mockeados)

    def test_normaliza_el_ticker_a_mayusculas(self, client: TestClient) -> None:
        respuesta = client.post(BACKTEST_URL, json=request_body(ticker=" btc-usd "))

        assert respuesta.status_code == 200
        assert respuesta.json()["summary"]["ticker"] == "BTC-USD"

    def test_chart_data_tiene_un_punto_por_fecha(
        self, client: TestClient, precios_mockeados: pd.Series
    ) -> None:
        chart = client.post(BACKTEST_URL, json=request_body()).json()["chart_data"]

        assert len(chart) == len(precios_mockeados)
        assert set(chart[0]) == {
            "date",
            "price",
            "invested",
            "portfolio_value",
            "is_buy",
        }

    def test_el_capital_acumulado_se_serializa_como_invested(self, client: TestClient) -> None:
        # El dataclass interno lo llama `cumulative_invested`; el JSON expone `invested`.
        chart = client.post(BACKTEST_URL, json=request_body()).json()["chart_data"]

        assert chart[0]["invested"] == 100.0
        assert "cumulative_invested" not in chart[0]

    def test_incluye_la_comparacion_contra_lump_sum(self, client: TestClient) -> None:
        lump = client.post(BACKTEST_URL, json=request_body()).json()["lump_sum"]

        assert set(lump) == {
            "capital",
            "units_bought",
            "final_value",
            "return_pct",
            "cagr_pct",
        }


class TestDensidadDeChartData:
    """
    `chart_data` conserva un punto por dia de la serie, no uno por periodo DCA.

    Es lo que da una curva de valor de portfolio real entre compras. Antes el fetcher
    remuestreaba antes de llegar a la estrategia, asi que en weekly y monthly todos los
    puntos eran compra y la distincion `is_buy` no distinguia nada.
    """

    def test_en_mensual_el_chart_conserva_todos_los_dias(
        self, client: TestClient, precios_mockeados: pd.Series
    ) -> None:
        chart = client.post(BACKTEST_URL, json=request_body(frequency="monthly")).json()[
            "chart_data"
        ]

        assert len(chart) == len(precios_mockeados)

    def test_en_mensual_solo_hay_compra_el_primer_dia_de_cada_mes(self, client: TestClient) -> None:
        # La serie mockeada va de 2020-01-01 a 2020-02-29 (60 dias).
        chart = client.post(BACKTEST_URL, json=request_body(frequency="monthly")).json()[
            "chart_data"
        ]

        compras = [p["date"] for p in chart if p["is_buy"]]
        assert compras == ["2020-01-01", "2020-02-01"]

    def test_en_semanal_hay_menos_compras_que_puntos(self, client: TestClient) -> None:
        chart = client.post(BACKTEST_URL, json=request_body(frequency="weekly")).json()[
            "chart_data"
        ]

        compras = [p for p in chart if p["is_buy"]]
        assert 0 < len(compras) < len(chart)

    def test_en_diario_todos_los_puntos_son_compra(self, client: TestClient) -> None:
        chart = client.post(BACKTEST_URL, json=request_body(frequency="daily")).json()["chart_data"]

        assert all(p["is_buy"] for p in chart)

    def test_el_valor_del_portfolio_se_actualiza_tambien_los_dias_sin_compra(
        self, client: TestClient
    ) -> None:
        # Sin esto el grafico entre compras seria una recta, no la curva real.
        chart = client.post(BACKTEST_URL, json=request_body(frequency="monthly")).json()[
            "chart_data"
        ]

        sin_compra = [p for p in chart if not p["is_buy"]]
        assert sin_compra
        assert all(p["portfolio_value"] > 0 for p in sin_compra)


class TestValidacionDelBody:
    def test_rango_menor_al_minimo_de_30_dias(self, client: TestClient) -> None:
        respuesta = client.post(
            BACKTEST_URL,
            json=request_body(start_date="2020-01-01", end_date="2020-01-15"),
        )

        assert respuesta.status_code == 422
        assert "30 días" in respuesta.text

    def test_exactamente_30_dias_es_valido(self, client: TestClient) -> None:
        respuesta = client.post(
            BACKTEST_URL,
            json=request_body(start_date="2020-01-01", end_date="2020-01-31"),
        )

        assert respuesta.status_code == 200

    def test_start_posterior_a_end(self, client: TestClient) -> None:
        respuesta = client.post(
            BACKTEST_URL,
            json=request_body(start_date="2020-12-31", end_date="2020-01-01"),
        )

        assert respuesta.status_code == 422
        assert "anterior a end_date" in respuesta.text

    def test_start_igual_a_end(self, client: TestClient) -> None:
        respuesta = client.post(
            BACKTEST_URL,
            json=request_body(start_date="2020-01-01", end_date="2020-01-01"),
        )

        assert respuesta.status_code == 422

    @pytest.mark.parametrize("ticker", ["SPY", "QQQ", "VTI"])
    def test_etf_con_frecuencia_diaria_no_esta_disponible(
        self, client: TestClient, ticker: str
    ) -> None:
        respuesta = client.post(BACKTEST_URL, json=request_body(ticker=ticker, frequency="daily"))

        assert respuesta.status_code == 422
        assert "frecuencia diaria no está disponible" in respuesta.text

    @pytest.mark.parametrize("frequency", ["weekly", "monthly"])
    def test_un_etf_si_acepta_semanal_y_mensual(self, client: TestClient, frequency: str) -> None:
        respuesta = client.post(BACKTEST_URL, json=request_body(ticker="SPY", frequency=frequency))

        assert respuesta.status_code == 200

    def test_ticker_fuera_de_la_lista_curada(self, client: TestClient) -> None:
        respuesta = client.post(BACKTEST_URL, json=request_body(ticker="TSLA"))

        assert respuesta.status_code == 422
        assert "Ticker no permitido" in respuesta.json()["detail"]

    def test_aporte_menor_al_minimo(self, client: TestClient) -> None:
        respuesta = client.post(BACKTEST_URL, json=request_body(amount_per_period=0.5))

        assert respuesta.status_code == 422

    def test_comision_fuera_de_rango(self, client: TestClient) -> None:
        assert client.post(BACKTEST_URL, json=request_body(commission_pct=101.0)).status_code == 422
        assert client.post(BACKTEST_URL, json=request_body(commission_pct=-1.0)).status_code == 422

    def test_frecuencia_inexistente(self, client: TestClient) -> None:
        respuesta = client.post(BACKTEST_URL, json=request_body(frequency="hourly"))

        assert respuesta.status_code == 422

    def test_campos_obligatorios_ausentes(self, client: TestClient) -> None:
        respuesta = client.post(BACKTEST_URL, json={"ticker": "BTC-USD"})

        assert respuesta.status_code == 422


class TestEstrategiasReservadas:
    @pytest.mark.parametrize("strategy", ["dca_weighted", "value_averaging"])
    def test_las_estrategias_del_contrato_sin_implementar_dan_422(
        self, client: TestClient, strategy: str
    ) -> None:
        # Estan en el enum del contrato pero no en el registry todavia.
        respuesta = client.post(BACKTEST_URL, json=request_body(strategy=strategy))

        assert respuesta.status_code == 422
        assert "Estrategia desconocida" in respuesta.json()["detail"]

    def test_una_estrategia_fuera_del_enum_la_rechaza_pydantic(self, client: TestClient) -> None:
        respuesta = client.post(BACKTEST_URL, json=request_body(strategy="martingala"))

        assert respuesta.status_code == 422


class TestMapeoDeErroresAStatusCode:
    """
    Contrato congelado: error de la capa de datos -> status code.

    Cada caso usa la excepción tipada y el mensaje literal que levanta hoy
    fetcher.py, alphavantage.py o binance.py. Los status esperados son los mismos
    que producía la clasificación por substrings anterior.

    Este archivo inyecta la excepción ya construida, así que por sí solo no puede
    demostrar que el refactor no cambió nada: la prueba independiente del mecanismo
    está en test_error_contract_integration.py, que hace nacer el error en la fuente
    real y no se modificó al migrar.
    """

    CASOS = [
        # (id, excepción, mensaje literal, status esperado)
        (
            "rango_invertido",
            InvalidDateRangeError,
            "Rango de fechas inválido: start (2024-06-01) es posterior a end (2024-01-01).",
            422,
        ),
        (
            "ticker_no_soportado",
            UnsupportedTickerError,
            "Ticker no soportado: 'DOGE-USD'. Use uno de los siguientes: BTC-USD, ETH-USD.",
            404,
        ),
        (
            "tipo_de_activo_no_soportado",
            UnsupportedAssetTypeError,
            "Tipo de activo no soportado para datos: 'bond'.",
            422,
        ),
        (
            "fuente_sin_datos",
            NoDataAvailableError,
            "No se pudieron obtener datos para el ticker 'BTC-USD' "
            "(respuesta vacía o rango inválido en la fuente).",
            422,
        ),
        (
            "serie_invalida",
            NoDataAvailableError,
            "No hay serie de precios válida para el ticker 'BTC-USD'.",
            422,
        ),
        (
            "sin_datos_en_el_rango",
            NoDataAvailableError,
            "No hay datos de precios para 'BTC-USD' en el rango 2023-01-01 -> 2023-06-01. "
            "Datos disponibles: 2020-01-01 -> 2020-01-30.",
            422,
        ),
        (
            "rate_limit_alpha_vantage",
            UpstreamRateLimitError,
            "Alpha Vantage indica límite de frecuencia (p. ej. 5 peticiones/minuto en el "
            "plan gratuito). Espera unos minutos o revisa tu cuota en alphavantage.co.",
            429,
        ),
        (
            "alpha_vantage_premium",
            UpstreamConfigError,
            "Alpha Vantage: respuesta de plan premium requerida. "
            "Verificá que ALPHAVANTAGE_API_KEY en .env sea válida y activa.",
            422,
        ),
        (
            "alpha_vantage_informativo",
            UpstreamResponseError,
            "Alpha Vantage devolvió un mensaje informativo (no serie de precios). Detalle: x",
            422,
        ),
        (
            "alpha_vantage_serie_vacia",
            UpstreamResponseError,
            "Serie vacía de Alpha Vantage (Weekly Adjusted Time Series) para 'SPY'.",
            422,
        ),
        (
            "falta_api_key",
            UpstreamConfigError,
            "Falta la variable de entorno ALPHAVANTAGE_API_KEY. Consigue una clave gratuita "
            "en https://www.alphavantage.co/support/#api-key y configúrala en el entorno.",
            422,
        ),
        (
            "alpha_vantage_rechaza",
            UpstreamResponseError,
            "Alpha Vantage rechazó la petición: Invalid API call.",
            422,
        ),
        (
            "bloque_ilegible",
            UpstreamResponseError,
            "No se pudo leer 'Weekly Adjusted Time Series' de Alpha Vantage para 'SPY'. "
            "Claves en la respuesta: ['Error Message']",
            422,
        ),
        (
            "error_de_binance",
            UpstreamResponseError,
            "Binance API error: 'Invalid symbol.' (code=-1121)",
            422,
        ),
        (
            "respuesta_inesperada_de_binance",
            UpstreamResponseError,
            "Respuesta inesperada de Binance: dict",
            422,
        ),
    ]

    IDS = [caso[0] for caso in CASOS]

    @pytest.mark.parametrize(
        ("excepcion", "mensaje", "status_esperado"),
        [(exc, mensaje, status) for _, exc, mensaje, status in CASOS],
        ids=IDS,
    )
    def test_status_code_por_tipo_de_error(
        self,
        client: TestClient,
        get_prices_que_falla: Callable[[Exception], None],
        excepcion: type[BacktestError],
        mensaje: str,
        status_esperado: int,
    ) -> None:
        get_prices_que_falla(excepcion(mensaje))

        respuesta = client.post(BACKTEST_URL, json=request_body())

        assert respuesta.status_code == status_esperado

    @pytest.mark.parametrize(
        ("excepcion", "mensaje"),
        [(exc, mensaje) for _, exc, mensaje, _ in CASOS],
        ids=IDS,
    )
    def test_el_mensaje_llega_intacto_al_cliente(
        self,
        client: TestClient,
        get_prices_que_falla: Callable[[Exception], None],
        excepcion: type[BacktestError],
        mensaje: str,
    ) -> None:
        # Los mensajes son UI: el frontend los muestra tal cual. No se pueden reescribir.
        get_prices_que_falla(excepcion(mensaje))

        respuesta = client.post(BACKTEST_URL, json=request_body())

        assert respuesta.json()["detail"] == mensaje

    def test_un_value_error_sin_tipar_sigue_siendo_422(
        self, client: TestClient, get_prices_que_falla: Callable[[Exception], None]
    ) -> None:
        # Fallback defensivo: el mismo comportamiento que tenía la rama final anterior.
        get_prices_que_falla(ValueError("algo que nadie tipó"))

        respuesta = client.post(BACKTEST_URL, json=request_body())

        assert respuesta.status_code == 422
        assert respuesta.json()["detail"] == "algo que nadie tipó"

    def test_todas_las_excepciones_de_dominio_son_value_error(self) -> None:
        # Heredar de ValueError es lo que hizo que la migración fuera aditiva:
        # cualquier `except ValueError` preexistente las sigue capturando.
        for _, excepcion, _, _ in self.CASOS:
            assert issubclass(excepcion, ValueError)


class TestErroresInesperados:
    def test_un_fallo_no_previsto_da_500_generico(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        class EstrategiaRota:
            def run(self, prices: pd.Series, params: dict) -> None:
                raise RuntimeError("detalle interno con info sensible")

        monkeypatch.setattr(backtest_endpoint, "get_strategy", lambda name: EstrategiaRota())

        respuesta = client.post(BACKTEST_URL, json=request_body())

        assert respuesta.status_code == 500

    def test_el_500_no_filtra_el_error_interno(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        class EstrategiaRota:
            def run(self, prices: pd.Series, params: dict) -> None:
                raise RuntimeError("detalle interno con info sensible")

        monkeypatch.setattr(backtest_endpoint, "get_strategy", lambda name: EstrategiaRota())

        respuesta = client.post(BACKTEST_URL, json=request_body())

        assert "sensible" not in respuesta.text
        assert respuesta.json()["detail"] == backtest_endpoint._500_DETAIL


class TestOtrosEndpoints:
    def test_health(self, client: TestClient) -> None:
        respuesta = client.get("/api/v1/health")

        assert respuesta.status_code == 200
        assert respuesta.json() == {"status": "ok"}

    def test_root(self, client: TestClient) -> None:
        assert client.get("/").status_code == 200

    def test_assets_lista_los_activos_curados(self, client: TestClient) -> None:
        respuesta = client.get("/api/v1/assets")

        assert respuesta.status_code == 200
        activos = respuesta.json()["assets"]
        assert {a["ticker"] for a in activos} == {
            "BTC-USD",
            "ETH-USD",
            "SOL-USD",
            "SPY",
            "QQQ",
            "VTI",
        }

    def test_assets_expone_tipo_y_fecha_de_inicio(self, client: TestClient) -> None:
        activos = client.get("/api/v1/assets").json()["assets"]

        btc = next(a for a in activos if a["ticker"] == "BTC-USD")
        assert btc["type"] == "crypto"
        assert btc["data_since"] == "2017-08-17"

    def test_assets_no_expone_el_simbolo_interno_de_binance(self, client: TestClient) -> None:
        activos = client.get("/api/v1/assets").json()["assets"]

        assert all("binance_symbol" not in a for a in activos)
