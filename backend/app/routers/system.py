from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.schemas import SystemHealth

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/health", response_model=SystemHealth)
async def health(session: AsyncSession = Depends(get_session)) -> SystemHealth:
    """สถานะของระบบหลังบ้าน ใช้แสดงในแถบ System & Database Health"""
    settings = get_settings()

    database_ok = True
    database_error: str | None = None
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 — อยากได้ข้อความ error ดิบไปแสดง
        database_ok = False
        database_error = f"{type(exc).__name__}: {exc}"[:160]

    return SystemHealth(
        api_ok=True,
        database_ok=database_ok,
        database_error=database_error,
        database_kind="postgres",
        ai_ready=settings.ai_ready,
        ai_model=settings.gemini_model,
        auth_ready=settings.auth_ready,
        github_repo=settings.github_repo or None,
        webhook_ready=bool(settings.github_webhook_secret),
        secrets_ready=settings.secrets_ready,
    )
