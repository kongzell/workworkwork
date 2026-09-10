from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_member
from app.db import get_session
from app.models import Member
from app.schemas import MemberOut

router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("", response_model=list[MemberOut])
async def list_members(
    _me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> list[Member]:
    rows = await session.scalars(select(Member).order_by(Member.created_at))
    return list(rows)

