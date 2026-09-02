"""GitHub Activity feed + ตัวรับ webhook

บน localhost ตัว webhook จะไม่มีอะไรยิงเข้ามา (GitHub เข้าถึงเครื่องไม่ได้)
แต่ endpoint ทำงานได้จริง ทดสอบได้ด้วยการ POST payload ตัวอย่างเข้ามาเอง
"""

import hashlib
import hmac
import re

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_member, require_member
from app.config import get_settings
from app.db import get_session
from app.models import Member, WebhookEvent
from app.schemas import (
    CommitOut,
    GithubRepo,
    ImportResult,
    MemberOut,
    WebhookEventOut,
)

router = APIRouter(prefix="/api/github", tags=["github"])

#: รูปแบบรหัสงานที่อ่านจากข้อความ commit เช่น "แก้ UI หน้าล็อกอิน #TASK-001"
TASK_REF = re.compile(r"#?(TASK-\d+)", re.IGNORECASE)


# สีสุ่มให้คนที่ดึงเข้ามาใหม่ ให้ avatar แยกกันออกตอนยังไม่มีรูป
IMPORT_COLORS = ["#7b68ee", "#3b82f6", "#ec4899", "#22c55e", "#f5a524", "#14b8a6", "#a855f7"]


async def _github_get(token: str, url: str, params: dict | None = None) -> list | dict:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.get(url, headers=headers, params=params)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"ต่อ GitHub ไม่ได้ ({type(exc).__name__})") from exc

    if res.status_code == 401:
        raise HTTPException(401, "token ของ GitHub หมดอายุ — ออกจากระบบแล้วเข้าใหม่อีกครั้ง")
    if res.status_code == 403:
        raise HTTPException(
            403,
            "token ยังไม่มีสิทธิ์อ่าน repo — ออกจากระบบแล้วเข้าสู่ระบบใหม่ "
            "แล้วกด Authorize เพื่ออนุญาตสิทธิ์เพิ่ม (หรือคุณไม่มีสิทธิ์ push ใน repo นี้)",
        )
    if res.status_code != 200:
        raise HTTPException(502, f"GitHub ตอบกลับ {res.status_code}: {res.text[:200]}")
    return res.json()


def _need_token(member: Member) -> str:
    if not member.github_token:
        raise HTTPException(
            400,
            "บัญชีนี้ไม่ได้เข้าสู่ระบบผ่าน GitHub — ออกจากระบบแล้วกด 'เข้าสู่ระบบด้วย GitHub' ก่อน",
        )
    return member.github_token


async def _upsert_people(
    session: AsyncSession, token: str, people: list[dict]
) -> tuple[int, int, list[Member]]:
    """สร้าง/อัปเดต member จากรายชื่อ GitHub — จับคู่ด้วย github_id"""
    created = 0
    updated = 0
    touched: list[Member] = []

    for index, person in enumerate(people):
        github_id = str(person["id"])
        existing = await session.scalar(select(Member).where(Member.github_id == github_id))

        if existing is None:
            # รายชื่อจาก GitHub ให้แค่ login กับรูป ต้องถามโปรไฟล์เพิ่มถ้าอยากได้ชื่อจริง
            profile = await _github_get(token, f"https://api.github.com/users/{person['login']}")
            existing = Member(
                name=profile.get("name") or person["login"],
                # GitHub ไม่มีข้อมูลว่าถนัดสายไหน ต้องให้เจ้าตัวเลือกเองทีหลัง
                role="Member",
                color=IMPORT_COLORS[index % len(IMPORT_COLORS)],
                github_id=github_id,
                email=profile.get("email"),
            )
            session.add(existing)
            created += 1
        else:
            updated += 1

        existing.github_login = person["login"]
        existing.avatar_url = person.get("avatar_url")
        touched.append(existing)

    await session.commit()
    for m in touched:
        await session.refresh(m)
    return created, updated, touched


@router.get("/repos", response_model=list[GithubRepo])
async def my_repos(member: Member = Depends(require_member)) -> list[dict]:
    """repo ที่คนล็อกอินมีสิทธิ์ push — อ่าน collaborator ได้เฉพาะ repo พวกนี้"""
    rows = await _github_get(
        _need_token(member),
        "https://api.github.com/user/repos",
        {
            "affiliation": "owner,collaborator,organization_member",
            "sort": "updated",
            "per_page": 100,
        },
    )
    return [
        {
            "full_name": r["full_name"],
            "private": r.get("private", False),
            "collaborator_count": None,
        }
        for r in rows
        if (r.get("permissions") or {}).get("push")
    ]


@router.post("/import-collaborators", response_model=ImportResult)
async def import_collaborators(
    repo: str,
    member: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> ImportResult:
    """ดึง collaborator ของ repo มาสร้างเป็นพนักงาน

    ต่างจาก org ตรงที่เห็นทุกคนที่ถูกเชิญเข้า repo แม้ยังไม่เคย commit
    """
    token = _need_token(member)
    people = await _github_get(
        token, f"https://api.github.com/repos/{repo}/collaborators", {"per_page": 100}
    )

    # GitHub นับเป็น collaborator เฉพาะคนที่กดรับคำเชิญแล้ว
    # คนที่ยังไม่ตอบรับอยู่อีก endpoint หนึ่ง — ดึงมาด้วยจะได้ไม่ต้องรอ
    pending: list[dict] = []
    try:
        invites = await _github_get(
            token, f"https://api.github.com/repos/{repo}/invitations", {"per_page": 100}
        )
        pending = [i["invitee"] for i in invites if i.get("invitee")]
    except HTTPException:
        # ต้องมีสิทธิ์ admin ถึงจะอ่านคำเชิญได้ — ถ้าอ่านไม่ได้ก็ข้ามไป
        pending = []

    seen = {str(p["id"]) for p in people}
    everyone = people + [p for p in pending if str(p["id"]) not in seen]

    created, updated, touched = await _upsert_people(session, token, everyone)
    return ImportResult(
        org=repo,
        created=created,
        updated=updated,
        pending=len(pending),
        members=[MemberOut.model_validate(m) for m in touched],
    )


@router.get("/commits", response_model=list[CommitOut])
async def commits(
    limit: int = 10,
    member: Member | None = Depends(current_member),
) -> list[CommitOut]:
    """ดึง commit ล่าสุดจาก repo ที่ตั้งไว้ใน GITHUB_REPO"""
    settings = get_settings()
    if not settings.github_repo:
        raise HTTPException(
            503,
            "ยังไม่ได้ตั้ง GITHUB_REPO — ใส่เป็น owner/repo ในไฟล์ .env "
            "(ต้อง push โปรเจคขึ้น GitHub ก่อน)",
        )

    url = f"https://api.github.com/repos/{settings.github_repo}/commits"
    headers = {"Accept": "application/vnd.github+json"}
    # repo ส่วนตัวต้องมี token ถึงจะอ่านได้ — ใช้ของคนที่ล็อกอินอยู่
    if member is not None and member.github_token:
        headers["Authorization"] = f"Bearer {member.github_token}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.get(url, headers=headers, params={"per_page": min(limit, 30)})
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"ต่อ GitHub ไม่ได้ ({type(exc).__name__})") from exc

    if res.status_code != 200:
        raise HTTPException(502, f"GitHub ตอบกลับ {res.status_code}: {res.text[:200]}")

    out: list[CommitOut] = []
    for row in res.json():
        message = (row.get("commit", {}).get("message") or "").split("\n")[0]
        match = TASK_REF.search(message)
        out.append(
            CommitOut(
                sha=row["sha"][:7],
                message=message,
                author=(row.get("author") or {}).get("login")
                or row.get("commit", {}).get("author", {}).get("name", "unknown"),
                date=row.get("commit", {}).get("author", {}).get("date", ""),
                url=row.get("html_url", ""),
                task_ref=match.group(1).upper() if match else None,
            )
        )
    return out


@router.get("/events", response_model=list[WebhookEventOut])
async def events(
    limit: int = 20,
    session: AsyncSession = Depends(get_session),
) -> list[WebhookEvent]:
    rows = await session.scalars(
        select(WebhookEvent).order_by(desc(WebhookEvent.received_at)).limit(min(limit, 100))
    )
    return list(rows)


@router.post("/webhook", status_code=202)
async def webhook(
    request: Request,
    x_github_event: str = Header(default="ping"),
    x_hub_signature_256: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, int]:
    """รับ event จาก GitHub แล้วเก็บลง webhook_events"""
    settings = get_settings()
    body = await request.body()

    if settings.github_webhook_secret:
        expected = "sha256=" + hmac.new(
            settings.github_webhook_secret.encode(), body, hashlib.sha256
        ).hexdigest()
        if not x_hub_signature_256 or not hmac.compare_digest(expected, x_hub_signature_256):
            raise HTTPException(401, "ลายเซ็นไม่ถูกต้อง")

    payload = await request.json()
    saved = [
        WebhookEvent(event=x_github_event, summary=summary, actor=actor, url=url, task_ref=ref)
        for summary, actor, url, ref in _summarize(x_github_event, payload)
    ]
    session.add_all(saved)
    await session.commit()
    return {"saved": len(saved)}


def _summarize(event: str, payload: dict) -> list[tuple[str, str | None, str | None, str | None]]:
    """แปลง payload ดิบให้เป็นบรรทัดสั้น ๆ ที่เอาไปแสดงได้เลย"""
    if event == "push":
        rows = []
        for commit in payload.get("commits", []):
            message = (commit.get("message") or "").split("\n")[0]
            match = TASK_REF.search(message)
            rows.append(
                (
                    message,
                    (commit.get("author") or {}).get("username")
                    or (commit.get("author") or {}).get("name"),
                    commit.get("url"),
                    match.group(1).upper() if match else None,
                )
            )
        return rows

    if event == "pull_request":
        pr = payload.get("pull_request", {})
        action = payload.get("action", "")
        title = pr.get("title", "")
        match = TASK_REF.search(title)
        return [
            (
                f"PR {action}: {title}",
                (pr.get("user") or {}).get("login"),
                pr.get("html_url"),
                match.group(1).upper() if match else None,
            )
        ]

    return [(f"event: {event}", (payload.get("sender") or {}).get("login"), None, None)]
