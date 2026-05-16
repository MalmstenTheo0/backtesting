# STRATEGY_GUIDE.md — Cómo agregar nuevas estrategias

Este documento explica la arquitectura de estrategias y cómo extender el sistema para agregar DCA Ponderado, Value Averaging, o cualquier otra estrategia futura.

---

## Principio de diseño

El endpoint `/api/v1/backtest` es agnóstico a la estrategia. Recibe el parámetro `strategy` (string), resuelve la clase en el registry, instancia la estrategia y delega el cálculo. Agregar una nueva estrategia implementada **no requiere modificar la ruta** del endpoint.

**Contrato vs registry:** el enum Pydantic `StrategyName` en `app/models/request.py` puede listar valores “reservados” antes de que exista código en `STRATEGY_REGISTRY`. Hoy `dca_weighted` y `value_averaging` están en el enum pero no en el registry → la API responde **422**. Al implementar una estrategia nueva: **(1)** clase + registro, **(2)** si el nombre es nuevo, añadirlo al enum (o quitar reservas no usadas), **(3)** documentar en `API.md` y `SPEC.md`.

---

## La clase base: `Strategy`

```python
# backend/app/strategies/base.py

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
import pandas as pd


@dataclass
class BuyEvent:
    """Representa una compra individual dentro del backtest."""
    date: date
    price: float
    amount_invested: float
    commission_paid: float
    units_bought: float


@dataclass
class DailySnapshot:
    """Estado del portfolio en un día dado."""
    date: date
    price: float
    cumulative_invested: float
    portfolio_value: float
    is_buy: bool


@dataclass
class BacktestMetrics:
    total_invested: float
    total_commissions_paid: float
    final_value: float
    absolute_return: float
    return_pct: float
    cagr_pct: float
    total_units: float


@dataclass
class LumpSumComparison:
    capital: float
    units_bought: float
    final_value: float
    return_pct: float
    cagr_pct: float


@dataclass
class BacktestResult:
    metrics: BacktestMetrics
    lump_sum: LumpSumComparison
    chart_data: list[DailySnapshot]
    buy_events: list[BuyEvent]


class Strategy(ABC):
    """
    Clase base para todas las estrategias de inversión.
    
    Cada estrategia recibe una serie de precios históricos y un diccionario
    de parámetros, y devuelve un BacktestResult estandarizado.
    
    El BacktestResult es el contrato de salida — el endpoint y el frontend
    no necesitan saber qué estrategia generó los datos.
    """

    @abstractmethod
    def run(self, prices: pd.Series, params: dict) -> BacktestResult:
        """
        Ejecuta el backtest.

        Args:
            prices: pd.Series con índice DatetimeIndex (fechas) y valores float (precios
                    de cierre ajustados). Ya filtrada al rango start_date → end_date.
            params: dict con los parámetros del request. Siempre incluye:
                    - amount_per_period: float
                    - frequency: str ("daily" | "weekly" | "monthly")
                    - commission_pct: float
                    Puede incluir parámetros adicionales según la estrategia.

        Returns:
            BacktestResult con métricas, comparación lump sum y datos para el gráfico.
        """
        ...

    def _calculate_lump_sum(
        self,
        prices: pd.Series,
        total_capital: float,
        commission_pct: float,
    ) -> LumpSumComparison:
        """
        Helper compartido por todas las estrategias para calcular el lump sum.
        Puede sobreescribirse si la estrategia necesita una comparación diferente.
        """
        first_price = prices.iloc[0]
        last_price = prices.iloc[-1]
        commission = total_capital * (commission_pct / 100)
        units = (total_capital - commission) / first_price
        final_value = units * last_price
        return_pct = ((final_value - total_capital) / total_capital) * 100
        years = (prices.index[-1] - prices.index[0]).days / 365.25
        cagr = ((final_value / total_capital) ** (1 / years) - 1) * 100 if years > 0 else 0

        return LumpSumComparison(
            capital=round(total_capital, 2),
            units_bought=round(units, 6),
            final_value=round(final_value, 2),
            return_pct=round(return_pct, 2),
            cagr_pct=round(cagr, 2),
        )

    def _get_period_dates(self, prices: pd.Series, frequency: str) -> pd.DatetimeIndex:
        """
        Fechas de compra alineadas al índice de `prices` (días hábiles presentes en la serie).

        - daily: todos los timestamps del índice.
        - weekly: primer índice por (año ISO, semana ISO) — evita perder semanas si el lunes no cotiza.
        - monthly: primer índice por mes calendario (`to_period("M")`) — evita perder meses si el día 1 no cotiza.
        """
        if frequency == "daily":
            return prices.index
        if frequency == "weekly":
            ic = prices.index.isocalendar()
            first_per_week = prices.groupby([ic["year"], ic["week"]], sort=True).head(1)
            return first_per_week.index
        if frequency == "monthly":
            first_per_month = prices.groupby(
                prices.index.to_period("M"), sort=True
            ).head(1)
            return first_per_month.index
        raise ValueError(f"Frecuencia no soportada: {frequency}")
```

---

## Ejemplo: DCA Tradicional implementado

```python
# backend/app/strategies/dca.py

import pandas as pd
from app.strategies.base import (
    Strategy, BacktestResult, BacktestMetrics,
    BuyEvent, DailySnapshot
)


class DCAStrategy(Strategy):
    """
    Dollar Cost Averaging tradicional.
    Invierte un monto fijo en cada período, independientemente del precio.
    """

    def run(self, prices: pd.Series, params: dict) -> BacktestResult:
        amount = params["amount_per_period"]
        frequency = params["frequency"]
        commission_pct = params.get("commission_pct", 0.0)

        buy_dates = set(self._get_period_dates(prices, frequency))

        # Estado acumulado
        total_units = 0.0
        total_invested = 0.0
        total_commissions = 0.0
        buy_events = []
        chart_data = []

        for date, price in prices.items():
            is_buy = date in buy_dates

            if is_buy:
                commission = amount * (commission_pct / 100)
                units_bought = (amount - commission) / price
                total_units += units_bought
                total_invested += amount
                total_commissions += commission

                buy_events.append(BuyEvent(
                    date=date.date(),
                    price=round(price, 6),
                    amount_invested=amount,
                    commission_paid=round(commission, 4),
                    units_bought=round(units_bought, 8),
                ))

            portfolio_value = total_units * price

            chart_data.append(DailySnapshot(
                date=date.date(),
                price=round(price, 6),
                cumulative_invested=round(total_invested, 2),
                portfolio_value=round(portfolio_value, 2),
                is_buy=is_buy,
            ))

        # Métricas finales
        final_value = total_units * prices.iloc[-1]
        absolute_return = final_value - total_invested
        return_pct = (absolute_return / total_invested * 100) if total_invested > 0 else 0
        years = (prices.index[-1] - prices.index[0]).days / 365.25
        cagr = ((final_value / total_invested) ** (1 / years) - 1) * 100 if years > 0 and total_invested > 0 else 0

        metrics = BacktestMetrics(
            total_invested=round(total_invested, 2),
            total_commissions_paid=round(total_commissions, 4),
            final_value=round(final_value, 2),
            absolute_return=round(absolute_return, 2),
            return_pct=round(return_pct, 2),
            cagr_pct=round(cagr, 2),
            total_units=round(total_units, 8),
        )

        lump_sum = self._calculate_lump_sum(prices, total_invested, commission_pct)

        return BacktestResult(
            metrics=metrics,
            lump_sum=lump_sum,
            chart_data=chart_data,
            buy_events=buy_events,
        )
```

---

## Cómo agregar una nueva estrategia

### Paso 1: Crear el archivo de estrategia

```python
# backend/app/strategies/dca_weighted.py

from app.strategies.base import Strategy, BacktestResult
import pandas as pd


class DCAWeightedStrategy(Strategy):
    """
    DCA Ponderado.
    Ajusta el monto de compra según la distancia del precio al promedio móvil.
    Compra más cuando el precio está "barato" y menos cuando está "caro".
    
    Parámetros adicionales (en params):
    - ma_window: int — ventana del promedio móvil (default: 200)
    - weight_factor: float — cuánto amplificar/reducir (default: 2.0)
    """

    def run(self, prices: pd.Series, params: dict) -> BacktestResult:
        base_amount = params["amount_per_period"]
        frequency = params["frequency"]
        commission_pct = params.get("commission_pct", 0.0)
        ma_window = params.get("ma_window", 200)
        weight_factor = params.get("weight_factor", 2.0)

        # Calcular promedio móvil
        ma = prices.rolling(window=ma_window, min_periods=1).mean()

        buy_dates = set(self._get_period_dates(prices, frequency))

        # ... implementación ...
        # El resto es igual a DCA pero con amount variable:
        # ratio = ma[date] / price  (>1 cuando precio < MA = barato)
        # adjusted_amount = base_amount * min(ratio * weight_factor, 3.0)  # cap en 3x

        raise NotImplementedError("DCA Ponderado — implementar en v1.1")
```

### Paso 2: Registrar en el registry

```python
# backend/app/strategies/registry.py

from app.strategies.base import Strategy
from app.strategies.dca import DCAStrategy
from app.strategies.dca_weighted import DCAWeightedStrategy  # agregar

STRATEGY_REGISTRY: dict[str, type[Strategy]] = {
    "dca": DCAStrategy,
    "dca_weighted": DCAWeightedStrategy,  # agregar
}


def get_strategy(name: str) -> Strategy:
    """Devuelve una instancia lista para llamar a ``run()``."""
    if name not in STRATEGY_REGISTRY:
        raise ValueError(
            f"Estrategia desconocida: '{name}'. Disponibles: {list(STRATEGY_REGISTRY.keys())}"
        )
    return STRATEGY_REGISTRY[name]()
```

### Paso 3: Extender el request y la documentación

Si la estrategia requiere parámetros adicionales (como `ma_window`), agregalos al modelo Pydantic `BacktestRequest` (o un submodelo), validá rangos, y documentá el contrato en `API.md` / `SPEC.md`.

### Paso 4: Actualizar `SPEC.md`

Documentar el comportamiento esperado de la nueva estrategia en la sección de Roadmap.

---

## Estrategias planificadas

### DCA Ponderado (v1.1)

**Concepto:** Ajusta el monto invertido según qué tan "barato" o "caro" está el activo relativo a su promedio móvil.

**Parámetros adicionales:**
- `ma_window`: int (default: 200) — ventana del MA de referencia
- `weight_factor`: float (default: 2.0) — amplificador del ajuste

**Lógica:**
```
ratio = MA(precio) / precio_hoy
# Si precio_hoy < MA → ratio > 1 → compra más
# Si precio_hoy > MA → ratio < 1 → compra menos
monto_ajustado = monto_base × clip(ratio × weight_factor, min=0.25, max=4.0)
```

---

### Value Averaging (v1.2)

**Concepto:** En lugar de invertir un monto fijo, invierte lo necesario para que el portfolio alcance un valor target creciente.

**Parámetros adicionales:**
- `monthly_target_growth`: float — cuánto debe crecer el portfolio por período (en USD)

**Lógica:**
```
target_value_en_periodo_n = monthly_target_growth × n
monto_a_invertir = target_value - portfolio_value_actual
# Puede ser negativo (vender) o mayor que el monto base
```

**Consideración:** Requiere capital de reserva. Si el mercado sube mucho, el monto a invertir puede ser 0 o negativo.

---

### DCA con RSI (v1.3)

**Concepto:** Solo ejecuta compras cuando el RSI del activo está por debajo de un umbral (activo oversold).

**Parámetros adicionales:**
- `rsi_period`: int (default: 14)
- `rsi_threshold`: float (default: 30) — solo compra si RSI < threshold
- `fallback`: bool — si true, compra igual aunque RSI esté alto (no pierde el período)
