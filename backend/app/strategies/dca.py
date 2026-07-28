import pandas as pd

from app.strategies.base import (
    BacktestMetrics,
    BacktestResult,
    BuyEvent,
    DailySnapshot,
    Strategy,
)


class DCAStrategy(Strategy):
    """
    Dollar Cost Averaging tradicional.
    Invierte un monto fijo en cada período, independientemente del precio.
    """

    def run(self, prices: pd.Series, params: dict) -> BacktestResult:
        if prices.empty:
            # Sin esta guarda pandas levanta IndexError desde `prices.iloc[-1]`,
            # que la capa HTTP traduce a un 500 opaco.
            raise ValueError(
                "No se puede simular sobre una serie de precios vacía."
            )

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
        return_pct = (
            (absolute_return / total_invested * 100) if total_invested > 0 else 0
        )
        years = (prices.index[-1] - prices.index[0]).days / 365.25
        cagr = (
            ((final_value / total_invested) ** (1 / years) - 1) * 100
            if years > 0 and total_invested > 0
            else 0
        )

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
