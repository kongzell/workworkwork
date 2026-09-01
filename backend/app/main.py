from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import get_settings
from app.routers import ai, auth, github, members, projects, system, tasks

settings = get_settings()

# docs วางไว้ใต้ /api เพื่อให้ผ่าน proxy ของ vite (dev) และ nginx (prod) ได้เหมือน endpoint อื่น
app = FastAPI(
    title="follow-up api",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router)
app.include_router(auth.router)
app.include_router(github.router)
app.include_router(system.router)
app.include_router(members.router)
app.include_router(projects.router)
app.include_router(tasks.router)


class Health(BaseModel):
    ok: bool
    service: str
    time: datetime


@app.get("/api/health")
def health() -> Health:
    return Health(ok=True, service="follow-up api", time=datetime.now(UTC))
