from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_dsn, echo=False, future=True)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """dependency ของ FastAPI — เปิด session ต่อหนึ่ง request แล้วปิดให้เอง"""
    async with SessionLocal() as session:
        yield session
