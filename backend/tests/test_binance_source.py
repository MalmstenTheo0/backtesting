"""
Tests de `app.data.sources.binance`: paginado, parseo de klines y errores de la API.

`requests.get` se reemplaza por respuestas falsas. La fixture `block_network` de
conftest.py sigue siendo la red de contención: si un test se olvidara de mockear,
falla en vez de salir a internet.
"""

from __future__ import annotations

import time
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
import requests

from app.data.sources import binance


def ms_utc(fecha: str) -> int:
    """Milisegundos UTC de la medianoche de `fecha`, como los devuelve Binance."""
    d = date.fromisoformat(fecha)
    return int(datetime(d.year, d.month, d.day, tzinfo=UTC).timestamp() * 1000)


def kline(fecha: str, close: float) -> list[Any]:
    """Una vela diaria con la forma real de Binance: [openTime, o, h, l, close, vol]."""
    return [ms_utc(fecha), "0", "0", "0", str(close), "0"]


def klines_diarias(inicio: str, cantidad: int, *, precio_base: float = 100.0) -> list[list[Any]]:
    d0 = date.fromisoformat(inicio)
    return [
        kline((d0 + timedelta(days=i)).isoformat(), precio_base + i)
        for i in range(cantidad)
    ]


class FakeResponse:
    def __init__(self, payload: Any) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> Any:
        return self._payload


@pytest.fixture(autouse=True)
def sin_esperas(monkeypatch: pytest.MonkeyPatch) -> None:
    """Los reintentos usan backoff exponencial; en tests no hace falta esperar."""
    monkeypatch.setattr(time, "sleep", lambda _s: None)


def responder_con(
    monkeypatch: pytest.MonkeyPatch, *respuestas: Any
) -> list[dict[str, Any]]:
    """Encola respuestas para llamadas sucesivas y registra los params de cada una."""
    pendientes = list(respuestas)
    llamadas: list[dict[str, Any]] = []

    def fake_get(url: str, params: dict[str, Any] | None = None, **kwargs: Any) -> Any:
        llamadas.append(params or {})
        siguiente = pendientes.pop(0) if pendientes else []
        if isinstance(siguiente, Exception):
            raise siguiente
        return FakeResponse(siguiente)

    monkeypatch.setattr(requests, "get", fake_get)
    return llamadas


class TestParseo:
    def test_construye_la_serie_con_el_precio_de_cierre(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        responder_con(
            monkeypatch,
            [kline("2024-01-01", 100.0), kline("2024-01-02", 110.0)],
        )

        serie = binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2024, 1, 1),
            end=date(2024, 1, 2),
        )

        assert serie.tolist() == [100.0, 110.0]
        assert [d.date().isoformat() for d in serie.index] == [
            "2024-01-01",
            "2024-01-02",
        ]

    def test_el_indice_es_naive_para_poder_compararse_con_fechas(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        responder_con(monkeypatch, [kline("2024-01-01", 100.0)])

        serie = binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2024, 1, 1),
            end=date(2024, 1, 1),
        )

        assert serie.index.tz is None
        assert serie.index.name == "Date"

    def test_la_serie_lleva_el_nombre_del_ticker(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        responder_con(monkeypatch, [kline("2024-01-01", 100.0)])

        serie = binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2024, 1, 1),
            end=date(2024, 1, 1),
        )

        assert serie.name == "BTC-USD"

    def test_ordena_por_fecha_aunque_lleguen_desordenadas(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        responder_con(
            monkeypatch,
            [kline("2024-01-03", 300.0), kline("2024-01-01", 100.0)],
        )

        serie = binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2024, 1, 1),
            end=date(2024, 1, 3),
        )

        assert serie.tolist() == [100.0, 300.0]

    def test_descarta_velas_duplicadas_quedandose_con_la_primera(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # El paginado puede solaparse y repetir la vela de borde.
        responder_con(
            monkeypatch,
            [
                kline("2024-01-01", 100.0),
                kline("2024-01-01", 999.0),
                kline("2024-01-02", 110.0),
            ],
        )

        serie = binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2024, 1, 1),
            end=date(2024, 1, 2),
        )

        assert serie.tolist() == [100.0, 110.0]


class TestPaginado:
    def test_pide_otra_pagina_cuando_la_respuesta_llega_al_limite(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # 1000 velas = limite de Binance, asi que hay que seguir pidiendo.
        # La primera pagina cubre 2020-01-01..2022-09-26; la segunda sigue desde el 27.
        primera = klines_diarias("2020-01-01", 1000)
        segunda = klines_diarias("2022-09-27", 3)
        llamadas = responder_con(monkeypatch, primera, segunda)

        serie = binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2020, 1, 1),
            end=date(2023, 1, 1),
        )

        assert len(llamadas) == 2
        assert len(serie) == 1003

    def test_deduplica_la_vela_de_borde_si_las_paginas_se_solapan(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Si la fuente repite la ultima vela de la pagina anterior, no se cuenta dos veces.
        primera = klines_diarias("2020-01-01", 1000)
        segunda = klines_diarias("2022-09-26", 3)  # arranca solapada
        responder_con(monkeypatch, primera, segunda)

        serie = binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2020, 1, 1),
            end=date(2023, 1, 1),
        )

        assert len(serie) == 1002
        assert serie.index.is_unique

    def test_corta_cuando_la_respuesta_es_menor_al_limite(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        llamadas = responder_con(monkeypatch, klines_diarias("2024-01-01", 5))

        binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2024, 1, 1),
            end=date(2024, 12, 31),
        )

        assert len(llamadas) == 1

    def test_avanza_el_cursor_entre_paginas(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        primera = klines_diarias("2020-01-01", 1000)
        llamadas = responder_con(monkeypatch, primera, [])

        binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2020, 1, 1),
            end=date(2023, 1, 1),
        )

        # La segunda pagina arranca el dia siguiente a la ultima vela recibida.
        assert llamadas[1]["startTime"] == ms_utc("2022-09-27")

    def test_manda_el_simbolo_y_el_intervalo_correctos(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        llamadas = responder_con(monkeypatch, [kline("2024-01-01", 100.0)])

        binance.fetch(
            binance_symbol="ETHUSDT",
            ticker="ETH-USD",
            data_since=date(2024, 1, 1),
            end=date(2024, 1, 1),
        )

        assert llamadas[0]["symbol"] == "ETHUSDT"
        assert llamadas[0]["interval"] == "1d"
        assert llamadas[0]["limit"] == 1000


class TestSeriesVacias:
    def test_sin_velas_devuelve_una_serie_vacia(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        responder_con(monkeypatch, [])

        serie = binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2024, 1, 1),
            end=date(2024, 1, 2),
        )

        assert serie.empty
        assert serie.name == "BTC-USD"

    def test_rango_invertido_no_llega_a_pedir_nada(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        llamadas = responder_con(monkeypatch)

        serie = binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2024, 6, 1),
            end=date(2024, 1, 1),
        )

        assert serie.empty
        assert llamadas == []


class TestErroresDeLaApi:
    def test_error_declarado_por_binance(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        responder_con(monkeypatch, {"code": -1121, "msg": "Invalid symbol."})

        with pytest.raises(ValueError, match="Binance API error"):
            binance.fetch(
                binance_symbol="NOPE",
                ticker="NOPE",
                data_since=date(2024, 1, 1),
                end=date(2024, 1, 2),
            )

    def test_respuesta_de_tipo_inesperado(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        responder_con(monkeypatch, "esto deberia ser una lista")

        with pytest.raises(ValueError, match="Respuesta inesperada de Binance"):
            binance.fetch(
                binance_symbol="BTCUSDT",
                ticker="BTC-USD",
                data_since=date(2024, 1, 1),
                end=date(2024, 1, 2),
            )

    def test_un_error_de_negocio_no_se_reintenta(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Reintentar un simbolo invalido no lo va a arreglar: se corta enseguida.
        llamadas = responder_con(monkeypatch, {"code": -1121, "msg": "Invalid symbol."})

        with pytest.raises(ValueError):
            binance.fetch(
                binance_symbol="NOPE",
                ticker="NOPE",
                data_since=date(2024, 1, 1),
                end=date(2024, 1, 2),
            )

        assert len(llamadas) == 1


class TestReintentos:
    def test_reintenta_ante_un_fallo_de_red_y_sigue(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        llamadas = responder_con(
            monkeypatch,
            requests.ConnectionError("timeout"),
            [kline("2024-01-01", 100.0)],
        )

        serie = binance.fetch(
            binance_symbol="BTCUSDT",
            ticker="BTC-USD",
            data_since=date(2024, 1, 1),
            end=date(2024, 1, 1),
        )

        assert len(llamadas) == 2
        assert serie.tolist() == [100.0]

    def test_se_rinde_despues_de_max_retries(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        llamadas = responder_con(
            monkeypatch,
            *[requests.ConnectionError("timeout")] * binance.MAX_RETRIES,
        )

        with pytest.raises(requests.ConnectionError):
            binance.fetch(
                binance_symbol="BTCUSDT",
                ticker="BTC-USD",
                data_since=date(2024, 1, 1),
                end=date(2024, 1, 1),
            )

        assert len(llamadas) == binance.MAX_RETRIES
