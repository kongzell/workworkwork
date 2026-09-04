"""การต่อฐานข้อมูล — รองรับทั้ง postgres ใน docker และ Neon บนคลาวด์

Neon ส่ง URL มาแบบ libpq (`?sslmode=require&channel_binding=require`) ซึ่ง asyncpg
ไม่รู้จัก ถ้าปล่อยผ่านไปตรง ๆ จะ error ตั้งแต่ connect แรก จึงต้องแยกพารามิเตอร์
พวกนี้ออกมาแปลงเป็น argument ของ asyncpg เองตรงนี้ที่เดียว
"""

import ssl
from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

#: พารามิเตอร์ที่เป็นของ libpq เท่านั้น asyncpg ไม่รับ ต้องถอดออกจาก URL ก่อน
_LIBPQ_ONLY = {"sslmode", "channel_binding", "options", "target_session_attrs"}

#: ค่า sslmode ที่แปลว่า "ต้องเข้ารหัส"
_SSL_REQUIRED = {"require", "verify-ca", "verify-full", "prefer"}


def build_connect_args(dsn: str | None = None) -> tuple[str, dict]:
    """คืน (dsn ที่ asyncpg รับได้, connect_args) — alembic ก็เรียกตัวนี้"""
    parts = urlsplit(dsn or get_settings().database_dsn)
    query = parse_qs(parts.query)

    kept = {k: v for k, v in query.items() if k not in _LIBPQ_ONLY}
    clean = urlunsplit(parts._replace(query=urlencode(kept, doseq=True)))

    args: dict = {}

    sslmode = (query.get("sslmode") or [""])[0]
    if sslmode in _SSL_REQUIRED:
        # ใช้ context มาตรฐาน = ตรวจใบรับรองจริง ไม่ใช่แค่เข้ารหัสแล้วปล่อยผ่าน
        args["ssl"] = ssl.create_default_context()

    # Neon ต่อผ่าน pgbouncer ในโหมด transaction ซึ่งใช้ prepared statement ข้าม
    # request ไม่ได้ ถ้าไม่ปิด cache จะพังแบบสุ่มตอนมีคนใช้พร้อมกัน
    if "-pooler" in (parts.hostname or "") or "pgbouncer" in query:
        args["statement_cache_size"] = 0

    return clean, args


_dsn, _connect_args = build_connect_args()

engine = create_async_engine(_dsn, echo=False, future=True, connect_args=_connect_args)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """dependency ของ FastAPI — เปิด session ต่อหนึ่ง request แล้วปิดให้เอง"""
    async with SessionLocal() as session:
        yield session
