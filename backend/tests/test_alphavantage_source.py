"""
Tests de `app.data.sources.alphavantage`.

Solo se ejercita `fetch_weekly_adjusted`, que es la única función que usa el fetcher.
La clasificación de mensajes de la API (rate limit, plan premium, error de símbolo) es
lo más valioso de cubrir: son los errores que después la capa HTTP traduce a status
codes distintos.
"""

from __future__ import annotations

import time
from typing import Any

import pytest
import requests

from app.data.sources import alphavantage

BLOQUE_SEMANAL = "Weekly Adjusted Time Series"


def payload_semanal(filas: dict[str, float]) -> dict[str, Any]:
    """Respuesta con la forma real de TIME_SERIES_WEEKLY_ADJUSTED."""
    return {
        "Meta Data": {"2. Symbol": "SPY"},
        BLOQUE_SEMANAL: {
            fecha: {
                "1. open": "1.0",
                "4. close": "0.0",  # distinto del ajustado, a proposito
                "5. adjusted close": str(precio),
            }
            for fecha, precio in filas.items()
        },
    }


class FakeResponse:
    def __init__(self, payload: Any) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> Any:
        return self._payload


@pytest.fixture(autouse=True)
def api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALPHAVANTAGE_API_KEY", "clave-de-test")


@pytest.fixture(autouse=True)
def sin_esperas(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(time, "sleep", lambda _s: None)


def responder_con(
    monkeypatch: pytest.MonkeyPatch, *respuestas: Any
) -> list[dict[str, Any]]:
    pendientes = list(respuestas)
    llamadas: list[dict[str, Any]] = []

    def fake_get(url: str, params: dict[str, Any] | None = None, **kwargs: Any) -> Any:
        llamadas.append(params or {})
        siguiente = pendientes.pop(0) if pendientes else {}
        if isinstance(siguiente, Exception):
            raise siguiente
        return FakeResponse(siguiente)

    monkeypatch.setattr(requests, "get", fake_get)
    return llamadas


class TestParseo:
    def test_usa_el_cierre_ajustado_no_el_cierre_crudo(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # El ajustado corrige splits y dividendos; usar "4. close" daria saltos falsos.
        responder_con(
            monkeypatch,
            payload_semanal({"2024-01-05": 470.5, "2024-01-12": 476.25}),
        )

        serie = alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

        assert serie.tolist() == [470.5, 476.25]

    def test_ordena_cronologicamente(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # La API devuelve del mas reciente al mas viejo.
        responder_con(
            monkeypatch,
            payload_semanal({"2024-01-12": 476.25, "2024-01-05": 470.5}),
        )

        serie = alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

        assert [d.date().isoformat() for d in serie.index] == [
            "2024-01-05",
            "2024-01-12",
        ]

    def test_la_serie_lleva_el_nombre_del_ticker(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        responder_con(monkeypatch, payload_semanal({"2024-01-05": 470.5}))

        serie = alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

        assert serie.name == "SPY"
        assert serie.index.name == "Date"

    def test_saltea_filas_sin_el_campo_de_cierre_ajustado(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        payload = payload_semanal({"2024-01-05": 470.5})
        payload[BLOQUE_SEMANAL]["2024-01-12"] = {"1. open": "1.0"}  # incompleta

        responder_con(monkeypatch, payload)
        serie = alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

        assert serie.tolist() == [470.5]

    def test_manda_la_funcion_y_la_clave_en_los_params(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        llamadas = responder_con(monkeypatch, payload_semanal({"2024-01-05": 470.5}))

        alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

        assert llamadas[0]["function"] == "TIME_SERIES_WEEKLY_ADJUSTED"
        assert llamadas[0]["symbol"] == "SPY"
        assert llamadas[0]["apikey"] == "clave-de-test"


class TestClaveDeApi:
    def test_sin_clave_falla_con_instrucciones(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("ALPHAVANTAGE_API_KEY", raising=False)

        with pytest.raises(ValueError, match="Falta la variable de entorno"):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

    def test_una_clave_en_blanco_cuenta_como_ausente(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("ALPHAVANTAGE_API_KEY", "   ")

        with pytest.raises(ValueError, match="Falta la variable de entorno"):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

    def test_no_sale_a_la_red_si_falta_la_clave(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("ALPHAVANTAGE_API_KEY", raising=False)
        llamadas = responder_con(monkeypatch)

        with pytest.raises(ValueError):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

        assert llamadas == []


class TestMensajesDeLaApi:
    def test_note_es_limite_de_frecuencia(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Es el unico error que la capa HTTP traduce a 429.
        responder_con(monkeypatch, {"Note": "Thank you for using Alpha Vantage!"})

        with pytest.raises(ValueError, match="límite de frecuencia"):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

    @pytest.mark.parametrize(
        "informacion",
        [
            "This is a premium endpoint.",
            "outputsize=full requires a premium plan",
        ],
        ids=["premium", "outputsize_full"],
    )
    def test_information_de_plan_premium(
        self, monkeypatch: pytest.MonkeyPatch, informacion: str
    ) -> None:
        responder_con(monkeypatch, {"Information": informacion})

        with pytest.raises(ValueError, match="plan premium requerida"):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

    def test_information_generico_se_reporta_con_el_detalle(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        responder_con(monkeypatch, {"Information": "Algo inesperado paso"})

        with pytest.raises(ValueError, match="mensaje informativo"):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

    def test_error_message_es_rechazo_de_la_peticion(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        responder_con(monkeypatch, {"Error Message": "Invalid API call."})

        with pytest.raises(ValueError, match="rechazó la petición"):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")


class TestRespuestasIlegibles:
    def test_sin_el_bloque_de_la_serie(self, monkeypatch: pytest.MonkeyPatch) -> None:
        responder_con(monkeypatch, {"Meta Data": {}})

        with pytest.raises(ValueError, match="No se pudo leer"):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

    def test_el_error_enumera_las_claves_recibidas(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Sin esto, depurar una respuesta rara de la API es a ciegas.
        responder_con(monkeypatch, {"Meta Data": {}})

        with pytest.raises(ValueError, match="Meta Data"):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

    def test_bloque_vacio(self, monkeypatch: pytest.MonkeyPatch) -> None:
        responder_con(monkeypatch, {BLOQUE_SEMANAL: {}})

        with pytest.raises(ValueError, match="No se pudo leer"):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

    def test_bloque_con_filas_pero_todas_ilegibles(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        responder_con(
            monkeypatch, {BLOQUE_SEMANAL: {"2024-01-05": {"1. open": "1.0"}}}
        )

        with pytest.raises(ValueError, match="Serie vacía"):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")


class TestReintentos:
    def test_reintenta_ante_un_fallo_de_red(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        llamadas = responder_con(
            monkeypatch,
            requests.ConnectionError("timeout"),
            payload_semanal({"2024-01-05": 470.5}),
        )

        serie = alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

        assert len(llamadas) == 2
        assert serie.tolist() == [470.5]

    def test_se_rinde_despues_de_max_retries(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        llamadas = responder_con(
            monkeypatch,
            *[requests.ConnectionError("timeout")] * alphavantage.MAX_RETRIES,
        )

        with pytest.raises(requests.ConnectionError):
            alphavantage.fetch_weekly_adjusted(symbol="SPY", ticker="SPY")

        assert len(llamadas) == alphavantage.MAX_RETRIES
