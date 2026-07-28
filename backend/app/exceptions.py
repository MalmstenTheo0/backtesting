"""
Excepciones de dominio del backtester.

El criterio para tipar un error es **de quién es el problema**:

- Si el request no se puede satisfacer (ticker inexistente, rango sin datos, la fuente
  externa rechazó la consulta), es un error de dominio: se tipa acá y la capa HTTP lo
  traduce al 4xx que corresponde vía ``http_status``.
- Si el error es un bug nuestro (una frecuencia que el enum debería haber filtrado, una
  serie vacía que el fetcher debería haber validado), se deja como ``ValueError`` pelado
  y sale como 500. Un 500 en ese caso es información correcta: hay algo roto.

Todas heredan de ``ValueError`` a propósito. Antes estos errores eran ``ValueError`` y
varios ``except ValueError`` los capturaban; heredar mantiene ese comportamiento y hace
que la migración sea aditiva en vez de un cambio incompatible.
"""

from __future__ import annotations

from fastapi import status


class BacktestError(ValueError):
    """Base de los errores de dominio. Por defecto, error de validación del request."""

    http_status: int = status.HTTP_422_UNPROCESSABLE_ENTITY


class UnsupportedTickerError(BacktestError):
    """El ticker no está en el catálogo de activos."""

    http_status = status.HTTP_404_NOT_FOUND


class UnsupportedAssetTypeError(BacktestError):
    """El activo existe pero su tipo no tiene fuente de datos asociada."""


class InvalidDateRangeError(BacktestError):
    """El rango de fechas pedido es incoherente."""


class NoDataAvailableError(BacktestError):
    """No hay serie de precios utilizable para lo que se pidió."""


class UnknownStrategyError(BacktestError):
    """La estrategia está en el contrato de la API pero no en el registry."""


class UpstreamRateLimitError(BacktestError):
    """La fuente externa nos está limitando por frecuencia de consultas."""

    http_status = status.HTTP_429_TOO_MANY_REQUESTS


class UpstreamConfigError(BacktestError):
    """Falta configuración para consultar la fuente, o el plan no alcanza."""


class UpstreamResponseError(BacktestError):
    """La fuente respondió algo que no se puede interpretar como serie de precios."""
