from fastapi import APIRouter

from app.constants import CURATED_TICKERS
from app.data.fetcher import get_assets
from app.models.response import AssetItem, AssetsResponse, AssetType

router = APIRouter()


@router.get("", response_model=AssetsResponse)
def list_assets() -> AssetsResponse:
    rows = get_assets()
    assert frozenset(r["ticker"] for r in rows) == CURATED_TICKERS, (
        "Los tickers de get_assets() deben coincidir con CURATED_TICKERS en app.constants"
    )
    assets = [
        AssetItem(
            ticker=r["ticker"],
            name=r["name"],
            type=AssetType(r["type"]),
            data_since=r["data_since"],
        )
        for r in rows
    ]
    return AssetsResponse(assets=assets)
