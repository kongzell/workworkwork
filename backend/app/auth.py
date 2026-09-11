"""session ผ่าน cookie ที่เซ็นด้วย itsdangerous

เก็บแค่ member id ไว้ใน cookie ไม่ได้เก็บอะไรที่เป็นความลับ
ตัว cookie เป็น httpOnly ทำให้ JavaScript ในหน้าเว็บอ่านไม่ได้
"""

from fastapi import Depends, HTTPException, Request
from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import Member

COOKIE_NAME = "3work_session"
MAX_AGE = 60 * 60 * 24 * 14  # 14 วัน


def _serializer() -> URLSafeSerializer:
    return URLSafeSerializer(get_settings().session_secret, salt="3work-session")


def make_cookie(member_id: str) -> str:
    return _serializer().dumps({"mid": member_id})


def read_cookie(raw: str | None) -> str | None:
    if not raw:
        return None
    try:
        data = _serializer().loads(raw)
    except BadSignature:
        return None
    return data.get("mid")


async def current_member(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> Member | None:
    """ผู้ใช้ที่ล็อกอินอยู่ — คืน None ถ้ายังไม่ล็อกอิน (ไม่ error)"""
    member_id = read_cookie(request.cookies.get(COOKIE_NAME))
    if member_id is None:
        return None
    return await session.get(Member, member_id)


async def require_member(member: Member | None = Depends(current_member)) -> Member:
    """ใช้กับ endpoint ที่ต้องล็อกอินก่อน"""
    if member is None:
        raise HTTPException(401, "You need to sign in first")
    return member
