import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import COOKIE_NAME, MAX_AGE, current_member, make_cookie, require_member
from app.config import get_settings
from app.db import get_session
from app.models import Member
from app.routers.github import auto_join_projects
from app.schemas import AuthStatus, MeOut, MemberUpdate

router = APIRouter(prefix="/api/auth", tags=["auth"])

AUTHORIZE = "https://github.com/login/oauth/authorize"
TOKEN = "https://github.com/login/oauth/access_token"
USER_API = "https://api.github.com/user"

#: read:user  = โปรไฟล์คนที่ล็อกอิน
#: read:org   = รายชื่อสมาชิก org/team
#: repo       = จำเป็นสำหรับอ่าน collaborator ของ repo (GitHub บังคับ ไม่มี scope ที่แคบกว่านี้)
SCOPES = "read:user read:org repo"

#: เก็บ state ของ OAuth ไว้ในหน่วยความจำ พอสำหรับ single instance
_pending_states: set[str] = set()


@router.get("/status", response_model=AuthStatus)
async def status(member: Member | None = Depends(current_member)) -> AuthStatus:
    settings = get_settings()
    return AuthStatus(
        configured=settings.github_ready,
        member=MeOut.model_validate(member) if member else None,
    )


@router.get("/github")
async def start_github() -> RedirectResponse:
    settings = get_settings()
    if not settings.github_ready:
        raise HTTPException(
            503,
            "GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET are not set — "
            "create an OAuth App at https://github.com/settings/developers and put them in .env",
        )
    state = secrets.token_urlsafe(24)
    _pending_states.add(state)
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_callback_url,
        "scope": SCOPES,
        "state": state,
    }
    return RedirectResponse(f"{AUTHORIZE}?{urlencode(params)}")


@router.get("/github/callback")
async def github_callback(
    request: Request,
    code: str = "",
    state: str = "",
    session: AsyncSession = Depends(get_session),
) -> RedirectResponse:
    settings = get_settings()
    if state not in _pending_states:
        raise HTTPException(400, "Invalid state — please sign in again")
    _pending_states.discard(state)
    if not code:
        raise HTTPException(400, "GitHub did not send a code back")

    async with httpx.AsyncClient(timeout=30) as client:
        token_res = await client.post(
            TOKEN,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_callback_url,
            },
        )
        token = token_res.json().get("access_token")
        if not token:
            raise HTTPException(502, f"Token exchange failed: {token_res.text[:200]}")

        user_res = await client.get(
            USER_API,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        )
        if user_res.status_code != 200:
            raise HTTPException(502, f"Could not read the profile: {user_res.status_code}")
        profile = user_res.json()

    member = await _upsert_member(session, profile, token)
    # เข้าโปรเจคที่ผูกกับ repo ของตัวเองให้เลย จะได้ไม่เจอหน้าเปล่าตอนล็อกอินครั้งแรก
    await auto_join_projects(session, member)
    response = RedirectResponse(url="/", status_code=303)
    _set_cookie(response, member.id, request)
    return response


@router.patch("/me", response_model=MeOut)
async def update_me(
    payload: MemberUpdate,
    member: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> Member:
    """เปลี่ยนบทบาทของตัวเอง — GitHub ไม่มีข้อมูลตำแหน่งงาน ต้องเลือกเอง"""
    if payload.role is not None:
        member.role = payload.role
    if payload.color is not None:
        member.color = payload.color
    if payload.email is not None:
        # ว่าง = เลิกรับแจ้งเตือน เก็บเป็น NULL ไม่ใช่สตริงว่าง
        cleaned = payload.email.strip()
        if cleaned and "@" not in cleaned:
            raise HTTPException(400, "That does not look like an email address")
        member.email = cleaned or None
    await session.commit()
    await session.refresh(member)
    return member


@router.post("/logout", status_code=204)
async def logout(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


# ---------- helper ----------

def _set_cookie(response: Response, member_id: str, request: Request) -> None:
    response.set_cookie(
        COOKIE_NAME,
        make_cookie(member_id),
        max_age=MAX_AGE,
        httponly=True,
        samesite="lax",
        # ตั้ง secure เฉพาะตอนเสิร์ฟผ่าน https ไม่งั้น cookie จะไม่ติดบน localhost
        secure=request.url.scheme == "https",
        path="/",
    )


async def _upsert_member(session: AsyncSession, profile: dict, token: str) -> Member:
    """หา member จาก github_id ถ้าไม่มีก็สร้างใหม่"""
    github_id = str(profile["id"])
    member = await session.scalar(select(Member).where(Member.github_id == github_id))

    if member is None:
        member = Member(
            name=profile.get("name") or profile["login"],
            role="Member",
            color="#7b68ee",
            github_id=github_id,
        )
        session.add(member)

    member.github_login = profile["login"]
    member.avatar_url = profile.get("avatar_url")
    member.email = profile.get("email")
    member.token = token
    await session.commit()
    await session.refresh(member)
    return member
