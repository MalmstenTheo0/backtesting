from app.exceptions import UnknownStrategyError
from app.strategies.base import Strategy
from app.strategies.dca import DCAStrategy

STRATEGY_REGISTRY: dict[str, type[Strategy]] = {
    "dca": DCAStrategy,
}


def get_strategy(name: str) -> Strategy:
    if name not in STRATEGY_REGISTRY:
        raise UnknownStrategyError(
            f"Estrategia desconocida: '{name}'. Disponibles: {list(STRATEGY_REGISTRY.keys())}"
        )
    return STRATEGY_REGISTRY[name]()
