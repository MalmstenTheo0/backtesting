import pandas as pd

from app.strategies.base import (
    BacktestMetrics,
    BacktestResult,
    BuyEvent,
    DailySnapshot,
    Strategy,
)
from app.strategies.metrics import money_weighted_return_pct


class DCAStrategy(Strategy):
    """
    Dollar Cost Averaging tradicional.
    Invierte un monto fijo en cada período, independientemente del precio.
    """

    def run(self, prices: pd.Series, params: dict) -> BacktestResult:
        if prices.empty:
            # Sin esta guarda pandas levanta IndexError desde `prices.iloc[-1]`,
            # que la capa HTTP traduce a un 500 opaco.
            raise ValueError("No se puede simular sobre una serie de precios vacía.")

        amount = params["amount_per_period"]
        frequency = params["frequency"]
        commission_pct = params.get("commission_pct", 0.0)

        buy_dates = set(self._get_period_dates(prices, frequency))

        total_units = 0.0
        total_invested = 0.0
        total_commissions = 0.0
        buy_events: list[BuyEvent] = []
        chart_data: list[DailySnapshot] = []

        for date, price in prices.items():
            is_buy = date in buy_dates

            if is_buy:
                commission = amount * (commission_pct / 100)
                units_bought = (amount - commission) / price
                total_units += units_bought
                total_invested += amount
                total_commissions += commission

                buy_events.append(
                    BuyEvent(
                        date=date.date(),
                        price=round(price, 6),
                        amount_invested=amount,
                        commission_paid=round(commission, 4),
                        units_bought=round(units_bought, 8),
                    )
                )

            portfolio_value = total_units * price

            chart_data.append(
                DailySnapshot(
                    date=date.date(),
                    price=round(price, 6),
                    cumulative_invested=round(total_invested, 2),
                    portfolio_value=round(portfolio_value, 2),
                    is_buy=is_buy,
                )
            )

        final_value = total_units * prices.iloc[-1]
        absolute_return = final_value - total_invested
        return_pct = (absolute_return / total_invested * 100) if total_invested > 0 else 0

        # Cada aporte se descuenta desde su propia fecha: el del último período estuvo
        # invertido días, no años. La fórmula anterior anualizaba sobre el total
        # aportado como si todo hubiera entrado el primer día, lo que reparte la
        # ganancia sobre más tiempo-dinero del que hubo y subestima el rendimiento.
        cash_flows = [(evento.date, -evento.amount_invested) for evento in buy_events]
        cash_flows.append((prices.index[-1].date(), float(final_value)))
        cagr = money_weighted_return_pct(cash_flows)

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
