"""
Tests de `money_weighted_return`: la TIR anualizada sobre flujos fechados.

Es el reemplazo del CAGR clásico para el DCA. Los valores esperados se derivan de la
ecuación del VPN, escrita en el comentario de cada test.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.strategies.metrics import money_weighted_return, money_weighted_return_pct


class TestEquivalenciaConElCagr:
    def test_un_solo_par_de_flujos_da_exactamente_el_cagr_clasico(self) -> None:
        # Con un único desembolso inicial, XIRR y CAGR son la misma ecuación:
        #   -C + V / (1 + r) ** años = 0   <=>   r = (V / C) ** (1 / años) - 1
        # 2020-01-01 -> 2022-01-01 son 731 días => 731 / 365.25 = 2.0013689 años.
        # (500 / 200) ** (1 / 2.0013689) - 1 = 0.580643
        tasa = money_weighted_return_pct([(date(2020, 1, 1), -200.0), (date(2022, 1, 1), 500.0)])

        cagr_cerrado = ((500 / 200) ** (365.25 / 731) - 1) * 100
        assert tasa == pytest.approx(cagr_cerrado, abs=1e-9)
        assert round(tasa, 2) == 58.06

    def test_duplicar_en_un_ano_da_alrededor_del_cien_por_ciento(self) -> None:
        # 2020 fue bisiesto: 2020-01-01 -> 2021-01-01 son 366 días, apenas más que un
        # año de 365.25. Duplicar en algo más de un año rinde algo menos de 100 %:
        #   2 ** (365.25 / 366) - 1 = 0.9971612
        tasa = money_weighted_return_pct([(date(2020, 1, 1), -100.0), (date(2021, 1, 1), 200.0)])

        assert tasa == pytest.approx(99.7161, abs=0.0001)
        assert tasa < 100.0


class TestPonderacionPorTiempo:
    def test_un_aporte_el_ultimo_dia_no_mueve_la_tasa(self) -> None:
        # Propiedad que define a la métrica: plata que entra el último día vuelve
        # intacta ese mismo día, así que no puede alterar el rendimiento anualizado.
        sin_aporte_final = money_weighted_return_pct(
            [(date(2020, 1, 1), -100.0), (date(2022, 1, 1), 400.0)]
        )
        con_aporte_final = money_weighted_return_pct(
            [
                (date(2020, 1, 1), -100.0),
                (date(2022, 1, 1), -100.0),
                (date(2022, 1, 1), 500.0),
            ]
        )

        assert con_aporte_final == pytest.approx(sin_aporte_final, abs=1e-9)

    def test_el_cagr_clasico_si_se_dejaria_arrastrar_por_ese_aporte(self) -> None:
        # Documenta el defecto que motivó el cambio. Sobre los mismos flujos, la
        # fórmula vieja reparte la ganancia entre los 200 aportados durante los 2 años
        # completos, aunque 100 de esos no estuvieron invertidos ni un día.
        formula_vieja = ((500 / 200) ** (365.25 / 731) - 1) * 100
        ponderada = money_weighted_return_pct(
            [
                (date(2020, 1, 1), -100.0),
                (date(2022, 1, 1), -100.0),
                (date(2022, 1, 1), 500.0),
            ]
        )

        assert round(formula_vieja, 2) == 58.06
        assert round(ponderada, 2) == 99.91
        assert ponderada > formula_vieja

    def test_aportes_escalonados(self) -> None:
        # -100 el día 0, -100 al año, +220 al año.
        # El segundo aporte vuelve intacto => -100 + 120 / (1 + r) ** años = 0
        # 2020-01-01 -> 2021-01-01 son 366 días => años = 366 / 365.25 = 1.0020534
        # r = 1.2 ** (1 / 1.0020534) - 1 = 0.199552
        tasa = money_weighted_return_pct(
            [
                (date(2020, 1, 1), -100.0),
                (date(2021, 1, 1), -100.0),
                (date(2021, 1, 1), 220.0),
            ]
        )

        assert tasa == pytest.approx(19.9552, abs=0.0001)


class TestSignoYPerdidas:
    def test_una_perdida_da_tasa_negativa(self) -> None:
        tasa = money_weighted_return_pct([(date(2020, 1, 1), -200.0), (date(2022, 1, 1), 100.0)])

        assert tasa < 0

    def test_perdida_total_es_menos_cien_por_ciento(self) -> None:
        tasa = money_weighted_return_pct([(date(2020, 1, 1), -100.0), (date(2022, 1, 1), 0.0)])

        assert tasa == -100.0

    def test_recuperar_exactamente_lo_aportado_da_cero(self) -> None:
        tasa = money_weighted_return_pct([(date(2020, 1, 1), -100.0), (date(2022, 1, 1), 100.0)])

        assert tasa == pytest.approx(0.0, abs=1e-9)


class TestCasosDegenerados:
    def test_sin_flujos(self) -> None:
        assert money_weighted_return([]) == 0.0

    def test_un_solo_flujo(self) -> None:
        assert money_weighted_return([(date(2020, 1, 1), -100.0)]) == 0.0

    def test_todos_los_flujos_el_mismo_dia_no_se_pueden_anualizar(self) -> None:
        assert money_weighted_return([(date(2020, 1, 1), -100.0), (date(2020, 1, 1), 200.0)]) == 0.0

    def test_sin_aportes(self) -> None:
        assert money_weighted_return([(date(2020, 1, 1), 0.0), (date(2022, 1, 1), 100.0)]) == 0.0

    def test_no_devuelve_nan_en_ningun_caso(self) -> None:
        casos = [
            [],
            [(date(2020, 1, 1), -100.0)],
            [(date(2020, 1, 1), -100.0), (date(2020, 1, 1), 200.0)],
            [(date(2020, 1, 1), -100.0), (date(2022, 1, 1), 0.0)],
            [(date(2020, 1, 1), 0.0), (date(2022, 1, 1), 0.0)],
            [(date(2020, 1, 1), -1e9), (date(2022, 1, 1), 1e-9)],
        ]

        for flujos in casos:
            tasa = money_weighted_return(flujos)
            assert tasa == tasa, f"nan con {flujos}"


class TestOrden:
    def test_el_orden_de_los_flujos_no_importa(self) -> None:
        desordenados = money_weighted_return_pct(
            [
                (date(2022, 1, 1), 500.0),
                (date(2020, 1, 1), -100.0),
                (date(2022, 1, 1), -100.0),
            ]
        )
        ordenados = money_weighted_return_pct(
            [
                (date(2020, 1, 1), -100.0),
                (date(2022, 1, 1), -100.0),
                (date(2022, 1, 1), 500.0),
            ]
        )

        assert desordenados == pytest.approx(ordenados, abs=1e-12)
