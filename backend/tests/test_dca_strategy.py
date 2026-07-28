"""
Tests del motor de cálculo: `DCAStrategy.run` y los helpers de `Strategy`.

Todos los valores esperados están calculados a mano y la derivación queda en el
comentario de cada test. Ninguno se copió de la salida del código: si se copiaran,
el test consagraría el bug en vez de detectarlo.
"""

from __future__ import annotations

import pytest

from app.strategies.base import Strategy
from app.strategies.dca import DCAStrategy
from tests.factories import constant_series, empty_series, price_series


def dca_params(
    *,
    amount: float = 100.0,
    frequency: str = "daily",
    commission_pct: float = 0.0,
) -> dict:
    return {
        "amount_per_period": amount,
        "frequency": frequency,
        "commission_pct": commission_pct,
    }


@pytest.fixture
def strategy() -> DCAStrategy:
    return DCAStrategy()


class TestCompras:
    def test_compra_una_vez_por_cada_punto_en_frecuencia_diaria(
        self, strategy: DCAStrategy
    ) -> None:
        # 3 días, precio constante 100, aporte 100 => 1 unidad por día.
        prices = constant_series("2024-01-01", 3, price=100.0)

        result = strategy.run(prices, dca_params())

        assert len(result.buy_events) == 3
        assert result.metrics.total_invested == 300.0
        assert result.metrics.total_units == 3.0

    def test_promedia_el_precio_de_entrada_al_comprar_en_la_baja(
        self, strategy: DCAStrategy
    ) -> None:
        # Precios 100 / 50 / 200, aporte 100 en cada uno:
        #   100/100 = 1.0 u | 100/50 = 2.0 u | 100/200 = 0.5 u  => 3.5 u
        # Valor final = 3.5 u * 200 = 700 sobre 300 invertidos => +400 (+133.33 %).
        prices = price_series(["2024-01-01", "2024-01-02", "2024-01-03"], [100.0, 50.0, 200.0])

        result = strategy.run(prices, dca_params())

        assert result.metrics.total_units == 3.5
        assert result.metrics.total_invested == 300.0
        assert result.metrics.final_value == 700.0
        assert result.metrics.absolute_return == 400.0
        assert result.metrics.return_pct == 133.33

    def test_registra_precio_y_unidades_de_cada_compra(self, strategy: DCAStrategy) -> None:
        prices = price_series(["2024-01-01", "2024-01-02"], [100.0, 50.0])

        result = strategy.run(prices, dca_params())

        primera, segunda = result.buy_events
        assert (primera.price, primera.units_bought) == (100.0, 1.0)
        assert (segunda.price, segunda.units_bought) == (50.0, 2.0)
        assert primera.amount_invested == segunda.amount_invested == 100.0

    def test_solo_compra_en_las_fechas_del_periodo_no_en_todas(self, strategy: DCAStrategy) -> None:
        # 14 días corridos con frecuencia semanal => 2 semanas ISO => 2 compras,
        # pero el chart mantiene un punto por día para poder dibujar la curva.
        prices = constant_series("2024-01-01", 14, price=100.0)

        result = strategy.run(prices, dca_params(frequency="weekly"))

        assert len(result.buy_events) == 2
        assert len(result.chart_data) == 14
        assert sum(1 for punto in result.chart_data if punto.is_buy) == 2


class TestComisiones:
    def test_sin_comision_no_descuenta_nada(self, strategy: DCAStrategy) -> None:
        prices = constant_series("2024-01-01", 3, price=100.0)

        result = strategy.run(prices, dca_params(commission_pct=0.0))

        assert result.metrics.total_commissions_paid == 0.0
        assert result.metrics.total_units == 3.0

    def test_la_comision_reduce_las_unidades_compradas(self, strategy: DCAStrategy) -> None:
        # Comisión 1 % sobre aportes de 100: se pagan 1.0 por compra y se invierten
        # 99 efectivos => 0.99 u por día, 2.97 u en 3 días.
        prices = constant_series("2024-01-01", 3, price=100.0)

        result = strategy.run(prices, dca_params(commission_pct=1.0))

        assert result.metrics.total_commissions_paid == 3.0
        assert result.metrics.total_units == 2.97
        assert result.metrics.final_value == 297.0
        assert result.metrics.absolute_return == -3.0
        assert result.metrics.return_pct == -1.0

    def test_la_comision_no_reduce_el_capital_invertido_declarado(
        self, strategy: DCAStrategy
    ) -> None:
        # Contrato actual: `total_invested` es lo que salió del bolsillo (aporte bruto),
        # y la comisión se reporta aparte en vez de restarse del aporte.
        prices = constant_series("2024-01-01", 3, price=100.0)

        result = strategy.run(prices, dca_params(commission_pct=1.0))

        assert result.metrics.total_invested == 300.0

    def test_commission_pct_es_opcional(self, strategy: DCAStrategy) -> None:
        prices = constant_series("2024-01-01", 2, price=100.0)

        result = strategy.run(prices, {"amount_per_period": 100.0, "frequency": "daily"})

        assert result.metrics.total_commissions_paid == 0.0


class TestCAGR:
    def test_calcula_cagr_anualizado_sobre_el_periodo_real(self, strategy: DCAStrategy) -> None:
        # 2020-01-01 -> 2022-01-01 son 731 días => 731 / 365.25 = 2.0013689 años.
        # Compras: 100/100 = 1.0 u y 100/400 = 0.25 u => 1.25 u; final 1.25 * 400 = 500.
        # ratio = 500 / 200 = 2.5  =>  CAGR = 2.5 ** (1 / 2.0013689) - 1 = 0.580643
        prices = price_series(["2020-01-01", "2022-01-01"], [100.0, 400.0])

        result = strategy.run(prices, dca_params())

        assert result.metrics.total_invested == 200.0
        assert result.metrics.final_value == 500.0
        assert result.metrics.cagr_pct == 58.06

    def test_cagr_es_cero_cuando_el_periodo_no_llega_a_un_dia(self, strategy: DCAStrategy) -> None:
        # Serie de un solo punto => years == 0 => no se puede anualizar.
        prices = price_series(["2024-01-01"], [100.0])

        result = strategy.run(prices, dca_params())

        assert result.metrics.cagr_pct == 0
        assert result.lump_sum.cagr_pct == 0

    def test_cagr_negativo_cuando_el_valor_final_cae(self, strategy: DCAStrategy) -> None:
        prices = price_series(["2020-01-01", "2022-01-01"], [100.0, 25.0])

        result = strategy.run(prices, dca_params())

        assert result.metrics.cagr_pct < 0


class TestLumpSum:
    def test_invierte_todo_el_capital_del_dca_al_precio_inicial(
        self, strategy: DCAStrategy
    ) -> None:
        # El DCA invirtió 200 en total; el lump sum mete esos 200 el primer día:
        # 200 / 100 = 2 u  =>  final 2 * 400 = 800  =>  +300 %.
        prices = price_series(["2020-01-01", "2022-01-01"], [100.0, 400.0])

        result = strategy.run(prices, dca_params())

        assert result.lump_sum.capital == 200.0
        assert result.lump_sum.units_bought == 2.0
        assert result.lump_sum.final_value == 800.0
        assert result.lump_sum.return_pct == 300.0
        # ratio 4.0 sobre 2.0013689 años => 4 ** (1 / 2.0013689) - 1 = 0.999052
        assert result.lump_sum.cagr_pct == 99.91

    def test_en_mercado_alcista_el_lump_sum_le_gana_al_dca(self, strategy: DCAStrategy) -> None:
        prices = price_series(["2020-01-01", "2022-01-01"], [100.0, 400.0])

        result = strategy.run(prices, dca_params())

        assert result.lump_sum.final_value > result.metrics.final_value

    def test_la_comision_del_lump_sum_se_cobra_una_sola_vez(self, strategy: DCAStrategy) -> None:
        # Comisión 1 % sobre 200 de capital = 2; se invierten 198 => 1.98 u
        # => final 1.98 * 400 = 792 => (792 - 200) / 200 = +296 %.
        prices = price_series(["2020-01-01", "2022-01-01"], [100.0, 400.0])

        result = strategy.run(prices, dca_params(commission_pct=1.0))

        assert result.lump_sum.units_bought == 1.98
        assert result.lump_sum.final_value == 792.0
        assert result.lump_sum.return_pct == 296.0


class TestChartData:
    def test_hay_un_punto_por_cada_fecha_de_la_serie(self, strategy: DCAStrategy) -> None:
        prices = constant_series("2024-01-01", 5, price=100.0)

        result = strategy.run(prices, dca_params())

        assert len(result.chart_data) == 5
        assert [p.date for p in result.chart_data] == [d.date() for d in prices.index]

    def test_el_capital_invertido_acumulado_nunca_baja(self, strategy: DCAStrategy) -> None:
        prices = price_series(["2024-01-01", "2024-01-02", "2024-01-03"], [100.0, 50.0, 200.0])

        result = strategy.run(prices, dca_params())

        acumulado = [p.cumulative_invested for p in result.chart_data]
        assert acumulado == sorted(acumulado)
        assert acumulado == [100.0, 200.0, 300.0]

    def test_el_valor_del_portfolio_sigue_al_precio(self, strategy: DCAStrategy) -> None:
        # Tras comprar 1 u a 100, si el precio se duplica el portfolio vale 200
        # aunque no se haya invertido nada nuevo ese día.
        prices = price_series(["2024-01-01", "2024-01-02"], [100.0, 200.0])

        result = strategy.run(prices, dca_params(frequency="weekly"))

        assert len(result.buy_events) == 1
        assert result.chart_data[0].portfolio_value == 100.0
        assert result.chart_data[1].portfolio_value == 200.0


class TestBordes:
    def test_serie_de_un_solo_punto(self, strategy: DCAStrategy) -> None:
        prices = price_series(["2024-01-01"], [100.0])

        result = strategy.run(prices, dca_params())

        assert len(result.buy_events) == 1
        assert result.metrics.total_invested == 100.0
        assert result.metrics.final_value == 100.0
        assert result.metrics.return_pct == 0
        assert result.lump_sum.final_value == 100.0

    def test_serie_vacia_da_un_error_de_dominio_no_un_crash(self, strategy: DCAStrategy) -> None:
        # Antes levantaba IndexError desde pandas, que el endpoint traducía a 500.
        with pytest.raises(ValueError, match="serie de precios vacía"):
            strategy.run(empty_series(), dca_params())

    def test_capital_cero_no_produce_nan(self, strategy: DCAStrategy) -> None:
        # Con aporte 0 el capital invertido es 0. `dca.py` ya evitaba la división,
        # pero `_calculate_lump_sum` no: devolvía nan, que no es JSON válido.
        prices = price_series(["2020-01-01", "2022-01-01"], [100.0, 400.0])

        result = strategy.run(prices, dca_params(amount=0.0))

        assert result.metrics.total_invested == 0.0
        assert result.metrics.return_pct == 0
        assert result.metrics.cagr_pct == 0
        assert result.lump_sum.return_pct == 0
        assert result.lump_sum.cagr_pct == 0

    def test_ninguna_metrica_es_nan_con_capital_cero(self, strategy: DCAStrategy) -> None:
        prices = price_series(["2020-01-01", "2022-01-01"], [100.0, 400.0])

        result = strategy.run(prices, dca_params(amount=0.0))

        valores = [
            *vars(result.metrics).values(),
            *vars(result.lump_sum).values(),
        ]
        assert all(v == v for v in valores), f"hay nan en {valores}"


class TestHelperLumpSum:
    """`_calculate_lump_sum` es compartido por todas las estrategias futuras."""

    def test_capital_cero_devuelve_ceros(self) -> None:
        class _Dummy(Strategy):
            def run(self, prices, params):  # pragma: no cover - no se usa
                raise NotImplementedError

        prices = constant_series("2024-01-01", 2, price=100.0)

        resultado = _Dummy()._calculate_lump_sum(prices, 0.0, 0.0)

        assert resultado.capital == 0.0
        assert resultado.units_bought == 0.0
        assert resultado.final_value == 0.0
        assert resultado.return_pct == 0.0
        assert resultado.cagr_pct == 0.0
