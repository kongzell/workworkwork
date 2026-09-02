from fastapi import APIRouter, Depends

from app import ai
from app.auth import require_member
from app.models import Member
from app.schemas import BreakdownRequest, BreakdownResult

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/breakdown", response_model=BreakdownResult)
async def breakdown(
    payload: BreakdownRequest,
    _me: Member = Depends(require_member),
) -> BreakdownResult:
    return await ai.breakdown(payload.title, payload.context, payload.count)
