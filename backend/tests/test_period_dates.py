"""
Tests de `Strategy._get_period_dates`: qué fechas del índice son fecha de compra.

Es la lógica más sutil del motor. El caso que importa es el que no se ve a simple
vista: si el lunes es feriado o el día 1 no cotiza, el período **no** se pierde —
se compra el primer día disponible dentro de ese período.

Nota de contexto: hoy `fetcher.get_prices()` ya remuestrea la serie antes de que
llegue a la estrategia, así que en el pipeline real esta función recibe una serie
con un punto por período y termina siendo la identidad. Los tests de acá la ejercitan
sobre series **diarias**, que es donde realmente filtra, y que es como la van a usar
las estrategias futuras documentadas en docs/STRATEGY_GUIDE.md.
"""

from __future__ import annotations

import pandas as pd
import pytest

from app.strategies.dca import DCAStrategy
from tests.factories import business_day_series, constant_series, price_series


def iso(index: pd.DatetimeIndex) -> list[str]:
    return [d.date().isoformat() for d in index]


@pytest.fixture
def strategy() -> DCAStrategy:
    return DCAStrategy()


class TestFrecuenciaDiaria:
    def test_compra_todos_los_dias_de_la_serie(self, strategy: DCAStrategy) -> None:
        prices = constant_series("2024-01-01", 5)

        assert list(strategy._get_period_dates(prices, "daily")) == list(prices.index)


class TestFrecuenciaSemanal:
    def test_elige_el_primer_dia_habil_cuando_el_lunes_no_cotiza(
        self, strategy: DCAStrategy
    ) -> None:
        # 2024-01-01 es lunes. La serie arranca el martes 2, o sea que la semana ISO 1
        # existe pero sin su lunes: la compra tiene que caer igual, el martes.
        prices = business_day_series("2024-01-02", "2024-01-19")

        assert iso(strategy._get_period_dates(prices, "weekly")) == [
            "2024-01-02",  # semana ISO 1 - martes, porque el lunes no está
            "2024-01-08",  # semana ISO 2 - lunes
            "2024-01-15",  # semana ISO 3 - lunes
        ]

    def test_agrupa_por_semana_iso_no_por_ano_calendario(self, strategy: DCAStrategy) -> None:
        # El caso borde del calendario ISO: 2019-12-30 y 2019-12-31 pertenecen a la
        # semana 1 de 2020, no a la última de 2019. Agrupar por (año, semana) del
        # calendario común partiría mal este tramo.
        prices = price_series(
            ["2019-12-27", "2019-12-30", "2019-12-31", "2020-01-02", "2020-01-06"],
            [1.0, 2.0, 3.0, 4.0, 5.0],
        )

        assert iso(strategy._get_period_dates(prices, "weekly")) == [
            "2019-12-27",  # ISO 2019-W52
            "2019-12-30",  # ISO 2020-W01 (aunque sea diciembre)
            "2020-01-06",  # ISO 2020-W02
        ]

    def test_no_inventa_compras_en_semanas_sin_datos(self, strategy: DCAStrategy) -> None:
        # Hueco de dos semanas: solo hay compra en las semanas que tienen precio.
        prices = price_series(
            ["2024-01-01", "2024-01-02", "2024-01-22", "2024-01-23"],
            [1.0, 2.0, 3.0, 4.0],
        )

        assert iso(strategy._get_period_dates(prices, "weekly")) == [
            "2024-01-01",
            "2024-01-22",
        ]


class TestFrecuenciaMensual:
    def test_elige_el_primer_dia_habil_cuando_el_dia_1_no_cotiza(
        self, strategy: DCAStrategy
    ) -> None:
        prices = price_series(
            ["2024-01-03", "2024-01-10", "2024-02-05", "2024-02-20", "2024-03-04"],
            [1.0, 2.0, 3.0, 4.0, 5.0],
        )

        assert iso(strategy._get_period_dates(prices, "monthly")) == [
            "2024-01-03",
            "2024-02-05",
            "2024-03-04",
        ]

    def test_distingue_el_mismo_mes_de_anos_distintos(self, strategy: DCAStrategy) -> None:
        prices = price_series(
            ["2023-12-05", "2023-12-20", "2024-01-08", "2024-12-03"],
            [1.0, 2.0, 3.0, 4.0],
        )

        assert iso(strategy._get_period_dates(prices, "monthly")) == [
            "2023-12-05",
            "2024-01-08",
            "2024-12-03",
        ]


class TestInvariantes:
    @pytest.mark.parametrize("frequency", ["daily", "weekly", "monthly"])
    def test_las_fechas_devueltas_siempre_existen_en_la_serie(
        self, strategy: DCAStrategy, frequency: str
    ) -> None:
        # Invariante clave: nunca se devuelve una fecha "sintética". Un remuestreo con
        # `resample` sí puede producir etiquetas de período que no son días de mercado.
        prices = business_day_series("2024-01-02", "2024-03-29")

        periodos = strategy._get_period_dates(prices, frequency)

        assert set(periodos).issubset(set(prices.index))

    @pytest.mark.parametrize("frequency", ["daily", "weekly", "monthly"])
    def test_las_fechas_devueltas_estan_ordenadas(
        self, strategy: DCAStrategy, frequency: str
    ) -> None:
        prices = business_day_series("2024-01-02", "2024-03-29")

        periodos = strategy._get_period_dates(prices, frequency)

        assert list(periodos) == sorted(periodos)

    @pytest.mark.parametrize("frequency", ["daily", "weekly", "monthly"])
    def test_serie_de_un_punto_da_exactamente_una_compra(
        self, strategy: DCAStrategy, frequency: str
    ) -> None:
        prices = price_series(["2024-01-01"], [100.0])

        assert iso(strategy._get_period_dates(prices, frequency)) == ["2024-01-01"]


class TestFrecuenciaInvalida:
    def test_frecuencia_desconocida_es_un_error(self, strategy: DCAStrategy) -> None:
        prices = constant_series("2024-01-01", 3)

        with pytest.raises(ValueError, match="Frecuencia no soportada"):
            strategy._get_period_dates(prices, "yearly")
