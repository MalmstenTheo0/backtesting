from fastapi import APIRouter

from app.models.response import HealthResponse

router = APIRouter()


@router.get("", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()
