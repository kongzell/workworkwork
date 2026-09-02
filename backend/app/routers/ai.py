from fastapi import APIRouter

from app import ai
from app.schemas import BreakdownRequest, BreakdownResult

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/breakdown", response_model=BreakdownResult)
async def breakdown(payload: BreakdownRequest) -> BreakdownResult:
    return await ai.breakdown(payload.title, payload.context, payload.count)
