"""
Retorno anualizado ponderado por dinero (XIRR).

El CAGR clásico asume un único desembolso al inicio. En un DCA eso no se cumple: el
aporte del último mes estuvo invertido semanas, no años. Anualizar con
``(valor_final / total_aportado) ** (1 / años)`` trata todo el capital como si hubiera
entrado el día uno, lo que **subestima** el rendimiento real cuando el activo sube,
porque reparte la ganancia sobre más tiempo-dinero del que hubo.

XIRR es la tasa que hace cero el valor presente de los flujos en sus fechas reales.
Para un único par de flujos coincide exactamente con el CAGR, así que la comparación
contra el lump sum sigue siendo entre magnitudes equivalentes.

Se resuelve por bisección: sin dependencias nuevas (``numpy-financial`` no forma parte
del stack) y sin los problemas de convergencia que tiene Newton cuando la derivada se
aplana.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date

# Misma convención que el resto del motor, para que XIRR y CAGR coincidan exactamente
# en el caso de un solo par de flujos.
DAYS_PER_YEAR = 365.25

_LOWER_BOUND = -1.0 + 1e-9
_MAX_RATE = 1e7
_ITERATIONS = 300


def _npv(rate: float, flows: Sequence[tuple[float, float]]) -> float:
    """Valor presente neto de flujos ya expresados en (años desde el inicio, monto)."""
    return sum(amount / (1.0 + rate) ** years for years, amount in flows)


def money_weighted_return(cash_flows: Sequence[tuple[date, float]]) -> float:
    """
    Tasa anual que hace cero el VPN de ``cash_flows``.

    Convención de signos: negativo es dinero que sale (un aporte), positivo es dinero
    que entra (el valor final de la posición). El resultado es una fracción: ``0.58``
    equivale a 58 % anual.

    Devuelve ``0.0`` cuando no hay nada que anualizar (menos de dos flujos, todos en la
    misma fecha, o sin flujos de ambos signos) y ``-1.0`` (-100 %) ante una pérdida
    total, que es el límite correcto y además lo que devolvía la fórmula anterior.
    """
    if len(cash_flows) < 2:
        return 0.0

    ordenados = sorted(cash_flows, key=lambda flujo: flujo[0])
    inicio = ordenados[0][0]
    fin = ordenados[-1][0]
    if fin == inicio:
        # Todo ocurrió el mismo día: no hay período sobre el cual anualizar.
        return 0.0

    egresos = sum(monto for _, monto in ordenados if monto < 0)
    ingresos = sum(monto for _, monto in ordenados if monto > 0)
    if egresos == 0:
        return 0.0
    if ingresos == 0:
        return -1.0

    flows = [((fecha - inicio).days / DAYS_PER_YEAR, monto) for fecha, monto in ordenados]

    bajo = _LOWER_BOUND
    valor_bajo = _npv(bajo, flows)

    alto = 1.0
    valor_alto = _npv(alto, flows)
    while valor_bajo * valor_alto > 0 and alto < _MAX_RATE:
        alto *= 2.0
        valor_alto = _npv(alto, flows)

    if valor_bajo * valor_alto > 0:
        # Flujos patológicos sin cambio de signo: no hay tasa que los anule.
        return 0.0

    for _ in range(_ITERATIONS):
        medio = (bajo + alto) / 2.0
        valor_medio = _npv(medio, flows)
        if valor_medio == 0.0:
            return medio
        if valor_bajo * valor_medio < 0:
            alto = medio
        else:
            bajo = medio
            valor_bajo = valor_medio

    return (bajo + alto) / 2.0


def money_weighted_return_pct(cash_flows: Sequence[tuple[date, float]]) -> float:
    """Igual que :func:`money_weighted_return` pero en puntos porcentuales."""
    return money_weighted_return(cash_flows) * 100
