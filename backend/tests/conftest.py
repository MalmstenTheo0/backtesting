"""
Fixtures compartidas por toda la suite.

Dos garantías globales, ambas `autouse`, para que se cumplan aunque un test futuro
se olvide de pedirlas:

1. **Sin red.** Ningún test puede llamar a Binance ni a Alpha Vantage. Las fuentes se
   mockean; si alguien las deja pasar, el test falla con un mensaje que explica qué
   mockear en vez de colgarse esperando un timeout.
2. **Sin caché real.** ``CACHE_DIR`` apunta a un directorio temporal por test, así que
   la suite nunca lee ni escribe ``backend/app/data/cache/``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, NoReturn

import pytest
import requests

_NETWORK_HINT = (
    "Un test intentó hacer una llamada HTTP real a {target!r}. "
    "La suite corre sin red por diseño: mockeá la fuente de datos "
    "(app.data.sources.binance.fetch o "
    "app.data.sources.alphavantage.fetch_weekly_adjusted) en vez de dejar salir la request."
)


@pytest.fixture(autouse=True)
def block_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Corta cualquier salida HTTP a nivel de ``requests``."""

    def _blocked(*args: Any, **kwargs: Any) -> NoReturn:
        # requests.get(url, ...) -> args[0]; Session.request(self, method, url, ...) -> args[2]
        target = (
            kwargs.get("url") or (args[2] if len(args) > 2 else None) or (args[0] if args else "?")
        )
        raise RuntimeError(_NETWORK_HINT.format(target=target))

    # Session.request es el punto único por donde pasa todo requests (incluido requests.get).
    monkeypatch.setattr(requests.sessions.Session, "request", _blocked)
    # Además se parchean los atajos del módulo, para que el error sea inmediato y explícito.
    monkeypatch.setattr(requests, "get", _blocked)
    monkeypatch.setattr(requests, "post", _blocked)


@pytest.fixture(autouse=True)
def cache_dir(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """
    Redirige el caché de precios a un directorio temporal.

    ``fetcher._cache_dir_path()`` lee ``CACHE_DIR`` en cada llamada, así que basta con
    sobrescribir la variable de entorno. Los tests que necesiten inspeccionar o sembrar
    el caché piden esta fixture por nombre.
    """
    path = tmp_path / "cache"
    path.mkdir()
    monkeypatch.setenv("CACHE_DIR", str(path))
    return path
