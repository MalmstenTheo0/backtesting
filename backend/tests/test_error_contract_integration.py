"""
Contrato de errores end-to-end: fuente HTTP -> fetcher -> endpoint -> status code.

A diferencia de `TestMapeoDeErroresAStatusCode`, acá **no** se mockea `get_prices`: solo
se falsea `requests.get`. El error nace en la fuente real y atraviesa toda la pila, así
que estos tests son independientes del mecanismo de clasificación.

Ese es justamente el punto: sirven para probar que migrar de "clasificar por substring
del mensaje" a "clasificar por tipo de excepción" no cambió ningún status code. Un test
que inyecta la excepción ya clasificada no podría demostrar eso.
"""

from __future__ import annotations

import time
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
import requests
from fastapi.testclient import TestClient

from app.main import app

BACKTEST_URL = "/api/v1/backtest"
BLOQUE_SEMANAL = "Weekly Adjusted Time Series"


def request_body(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "ticker": "BTC-USD",
        "amount_per_period": 100.0,
        "frequency": "daily",
        "start_date": "2024-01-01",
        "end_date": "2024-06-01",
        "commission_pct": 0.0,
        "strategy": "dca",
    }
    payload.update(overrides)
    return payload


def body_etf(**overrides: Any) -> dict[str, Any]:
    return request_body(ticker="SPY", frequency="weekly", **overrides)


class FakeResponse:
    def __init__(self, payload: Any) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> Any:
        return self._payload


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def entorno(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALPHAVANTAGE_API_KEY", "clave-de-test")
    monkeypatch.setattr(time, "sleep", lambda _s: None)


@pytest.fixture
def fuente_responde(monkeypatch: pytest.MonkeyPatch):
    def _configurar(payload: Any) -> None:
        monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResponse(payload))

    return _configurar


def kline(fecha: str, close: float) -> list[Any]:
    d = date.fromisoformat(fecha)
    ms = int(datetime(d.year, d.month, d.day, tzinfo=UTC).timestamp() * 1000)
    return [ms, "0", "0", "0", str(close), "0"]


class TestErroresDeAlphaVantage:
    def test_limite_de_frecuencia_da_429(self, client: TestClient, fuente_responde) -> None:
        fuente_responde({"Note": "Thank you for using Alpha Vantage!"})

        respuesta = client.post(BACKTEST_URL, json=body_etf())

        assert respuesta.status_code == 429
        assert "límite de frecuencia" in respuesta.json()["detail"]

    def test_plan_premium_da_422(self, client: TestClient, fuente_responde) -> None:
        fuente_responde({"Information": "This is a premium endpoint."})

        assert client.post(BACKTEST_URL, json=body_etf()).status_code == 422

    def test_mensaje_informativo_da_422(self, client: TestClient, fuente_responde) -> None:
        fuente_responde({"Information": "Algo inesperado paso"})

        assert client.post(BACKTEST_URL, json=body_etf()).status_code == 422

    def test_peticion_rechazada_da_422(self, client: TestClient, fuente_responde) -> None:
        fuente_responde({"Error Message": "Invalid API call."})

        assert client.post(BACKTEST_URL, json=body_etf()).status_code == 422

    def test_respuesta_sin_el_bloque_de_datos_da_422(
        self, client: TestClient, fuente_responde
    ) -> None:
        fuente_responde({"Meta Data": {}})

        assert client.post(BACKTEST_URL, json=body_etf()).status_code == 422

    def test_falta_la_clave_de_api_da_422(
        self, client: TestClient, fuente_responde, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("ALPHAVANTAGE_API_KEY", raising=False)
        fuente_responde({})

        respuesta = client.post(BACKTEST_URL, json=body_etf())

        assert respuesta.status_code == 422
        assert "ALPHAVANTAGE_API_KEY" in respuesta.json()["detail"]


class TestErroresDeBinance:
    def test_error_de_la_api_da_422(self, client: TestClient, fuente_responde) -> None:
        fuente_responde({"code": -1121, "msg": "Invalid symbol."})

        respuesta = client.post(BACKTEST_URL, json=request_body())

        assert respuesta.status_code == 422
        assert "Binance API error" in respuesta.json()["detail"]

    def test_respuesta_de_tipo_inesperado_da_422(self, client: TestClient, fuente_responde) -> None:
        fuente_responde("esto deberia ser una lista")

        assert client.post(BACKTEST_URL, json=request_body()).status_code == 422

    def test_sin_datos_da_422(self, client: TestClient, fuente_responde) -> None:
        fuente_responde([])

        respuesta = client.post(BACKTEST_URL, json=request_body())

        assert respuesta.status_code == 422
        assert "No se pudieron obtener datos" in respuesta.json()["detail"]


class TestErroresDeRango:
    def test_rango_pedido_fuera_de_los_datos_disponibles_da_422(
        self, client: TestClient, fuente_responde
    ) -> None:
        # La fuente solo tiene 2019; se pide 2024.
        fuente_responde([kline("2019-01-01", 100.0), kline("2019-01-02", 101.0)])

        respuesta = client.post(BACKTEST_URL, json=request_body())

        assert respuesta.status_code == 422
        assert "Datos disponibles" in respuesta.json()["detail"]


class TestCaminoFeliz:
    def test_una_respuesta_valida_de_la_fuente_da_200(
        self, client: TestClient, fuente_responde
    ) -> None:
        # Control: si la fuente responde bien, la misma pila entrega 200.
        inicio = date(2024, 1, 1)
        fuente_responde(
            [kline((inicio + timedelta(days=i)).isoformat(), 100.0 + i) for i in range(120)]
        )

        respuesta = client.post(BACKTEST_URL, json=request_body())

        assert respuesta.status_code == 200
        assert respuesta.json()["summary"]["ticker"] == "BTC-USD"
