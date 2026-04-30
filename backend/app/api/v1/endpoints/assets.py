from fastapi import APIRouter

from app.models.response import AssetsResponse

router = APIRouter()


@router.get("", response_model=AssetsResponse)
def list_assets() -> AssetsResponse:
    return AssetsResponse(assets=[])
