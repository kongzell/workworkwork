from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Member
from app.schemas import MemberCreate, MemberOut

router = APIRouter(prefix="/api/members", tags=["members"])


@router.get("", response_model=list[MemberOut])
async def list_members(session: AsyncSession = Depends(get_session)) -> list[Member]:
    rows = await session.scalars(select(Member).order_by(Member.created_at))
    return list(rows)


@router.post("", response_model=MemberOut, status_code=201)
async def create_member(
    payload: MemberCreate,
    session: AsyncSession = Depends(get_session),
) -> Member:
    member = Member(name=payload.name, role=payload.role, color=payload.color)
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member
