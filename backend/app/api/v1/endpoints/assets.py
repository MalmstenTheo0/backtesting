from datetime import date

from fastapi import APIRouter

from app.constants import CURATED_TICKERS
from app.models.response import AssetItem, AssetType, AssetsResponse

router = APIRouter()

_CURATED_ASSETS: tuple[AssetItem, ...] = (
    AssetItem(
        ticker="BTC-USD",
        name="Bitcoin",
        type=AssetType.crypto,
        data_since=date(2014, 9, 17),
    ),
    AssetItem(
        ticker="ETH-USD",
        name="Ethereum",
        type=AssetType.crypto,
        data_since=date(2015, 8, 7),
    ),
    AssetItem(
        ticker="SOL-USD",
        name="Solana",
        type=AssetType.crypto,
        data_since=date(2020, 4, 10),
    ),
    AssetItem(
        ticker="BNB-USD",
        name="BNB",
        type=AssetType.crypto,
        data_since=date(2017, 11, 9),
    ),
    AssetItem(
        ticker="SPY",
        name="S&P 500 ETF",
        type=AssetType.etf,
        data_since=date(1993, 1, 29),
    ),
    AssetItem(
        ticker="QQQ",
        name="Nasdaq 100 ETF",
        type=AssetType.etf,
        data_since=date(1999, 3, 10),
    ),
    AssetItem(
        ticker="VTI",
        name="Total Market ETF",
        type=AssetType.etf,
        data_since=date(2001, 6, 15),
    ),
    AssetItem(
        ticker="VOO",
        name="Vanguard S&P 500",
        type=AssetType.etf,
        data_since=date(2010, 9, 9),
    ),
    AssetItem(
        ticker="AAPL",
        name="Apple",
        type=AssetType.stock,
        data_since=date(1980, 12, 12),
    ),
    AssetItem(
        ticker="MSFT",
        name="Microsoft",
        type=AssetType.stock,
        data_since=date(1986, 3, 13),
    ),
    AssetItem(
        ticker="NVDA",
        name="NVIDIA",
        type=AssetType.stock,
        data_since=date(1999, 1, 22),
    ),
    AssetItem(
        ticker="AMZN",
        name="Amazon",
        type=AssetType.stock,
        data_since=date(1997, 5, 16),
    ),
    AssetItem(
        ticker="GOOGL",
        name="Alphabet",
        type=AssetType.stock,
        data_since=date(2004, 8, 19),
    ),
)

assert frozenset(a.ticker for a in _CURATED_ASSETS) == CURATED_TICKERS, (
    "La lista de activos debe coincidir exactamente con CURATED_TICKERS"
)


@router.get("", response_model=AssetsResponse)
def list_assets() -> AssetsResponse:
    return AssetsResponse(assets=list(_CURATED_ASSETS))
