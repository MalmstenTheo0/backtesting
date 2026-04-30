from app.strategies.dca import DCAStrategy
from app.strategies.base import Strategy

STRATEGY_REGISTRY: dict[str, type[Strategy]] = {
    "dca": DCAStrategy,
}


def get_strategy(name: str) -> Strategy:
    if name not in STRATEGY_REGISTRY:
        raise ValueError(
            f"Estrategia desconocida: '{name}'. Disponibles: {list(STRATEGY_REGISTRY.keys())}"
        )
    return STRATEGY_REGISTRY[name]()
