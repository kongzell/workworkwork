from fastapi import APIRouter

from app import ai
from app.config import get_settings
from app.schemas import BreakdownRequest, BreakdownResult

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/status")
def status() -> dict[str, bool | str]:
    """ให้ frontend รู้ล่วงหน้าว่ากดปุ่ม AI ได้หรือยัง"""
    settings = get_settings()
    return {
        "ready": settings.ai_ready,
        "mock": settings.ai_mock and not settings.gemini_api_key,
        "model": settings.gemini_model,
    }


@router.post("/breakdown", response_model=BreakdownResult)
async def breakdown(payload: BreakdownRequest) -> BreakdownResult:
    return await ai.breakdown(payload.title, payload.context, payload.count)
