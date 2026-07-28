"""
Tests de la infraestructura de testing.

No prueban lógica de negocio: prueban que las garantías de `conftest.py` realmente se
cumplen. Si alguien desactiva una fixture `autouse` sin querer, estos tests lo detectan
antes de que la suite empiece a pegarle a APIs reales o a pisar el caché del repo.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import requests

from app.data import fetcher


class TestNetworkGuard:
    def test_requests_get_esta_bloqueado(self) -> None:
        with pytest.raises(RuntimeError, match="llamada HTTP real"):
            requests.get("https://api.binance.com/api/v3/klines")

    def test_requests_session_request_esta_bloqueado(self) -> None:
        with pytest.raises(RuntimeError, match="llamada HTTP real"):
            requests.sessions.Session().request("GET", "https://www.alphavantage.co/query")

    def test_el_error_nombra_la_url_para_que_el_fallo_se_explique_solo(self) -> None:
        with pytest.raises(RuntimeError, match="alphavantage"):
            requests.get("https://www.alphavantage.co/query")


class TestCacheIsolation:
    def test_cache_dir_apunta_al_tmp_del_test(self, cache_dir: Path) -> None:
        assert fetcher._cache_dir_path().resolve() == cache_dir.resolve()

    def test_cache_dir_no_es_el_cache_real_del_repo(self, cache_dir: Path) -> None:
        real_cache = Path(fetcher.__file__).resolve().parent / "cache"
        assert cache_dir.resolve() != real_cache
        assert not cache_dir.resolve().is_relative_to(real_cache)

    def test_el_tmp_arranca_vacio_en_cada_test(self, cache_dir: Path) -> None:
        assert list(cache_dir.iterdir()) == []
