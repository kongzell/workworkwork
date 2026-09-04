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

from app.auth import require_member
from app.config import get_settings
from app.db import get_session
from app.models import Member, Project, Task, WebhookEvent
from app.schemas import (
    CommitOut,
    GithubRepo,
    ImportResult,
    MemberOut,
    WebhookEventOut,
)

router = APIRouter(prefix="/api/github", tags=["github"])

#: รหัสงานในข้อความ commit เช่น "แก้ UI หน้าล็อกอิน KST-001"
#: ส่วนหน้าคือ task_prefix ของโปรเจค ส่วนหลังคือเลขงาน ใส่ # นำหน้าหรือไม่ก็ได้
TASK_REF = re.compile(r"#?\b([A-Za-z][A-Za-z0-9]{0,9})-0*(\d+)\b")


def _read_ref(text: str) -> str | None:
    """ดึงรหัสงานจากข้อความ คืนรูปแบบมาตรฐานตัวใหญ่ เช่น "KST-1" -> "KST-001\""""
    match = TASK_REF.search(text)
    if match is None:
        return None
    return f"{match.group(1).upper()}-{int(match.group(2)):03d}"


async def _advance_referenced_tasks(
    session: AsyncSession,
    repo: str | None,
    refs: list[str],
    status: str,
    branch: str | None = None,
    review_url: str | None = None,
) -> int:
    """ย้ายการ์ดที่ commit หรือ PR อ้างถึงไปยังสถานะที่กำหนด

    หาเฉพาะโปรเจคที่ผูกกับ repo ที่ยิงเข้ามา ทำให้รหัสย่อซ้ำกันข้าม repo ไม่กวนกัน
    งานที่ปิดไปแล้วไม่ถูกดึงกลับ เพราะ commit ตามหลังการปิดงานเป็นเรื่องปกติ
    """
    if not repo or not refs:
        return 0

    projects = list(
        await session.scalars(select(Project).where(Project.github_repo == repo))
    )
    if not projects:
        return 0

    moved = 0
    for ref in set(refs):
        prefix, _, number = ref.rpartition("-")
        for project in projects:
            if project.task_prefix.upper() != prefix:
                continue
            task = await session.scalar(
                select(Task).where(
                    Task.project_id == project.id, Task.number == int(number)
                )
            )
            if task is None or task.status == "complete":
                continue

            # เก็บที่อยู่ของโค้ดไว้เสมอ แม้สถานะจะไม่ได้เปลี่ยน
            # จะได้กดจากการ์ดไปดู diff ได้ตอนตรวจงาน
            if branch:
                task.branch = branch
            if review_url:
                task.review_url = review_url

            if task.status != status:
                task.status = status
            moved += 1

    if moved:
        await session.commit()
    return moved


def _code_location(event: str, payload: dict) -> tuple[str | None, str | None]:
    """ที่อยู่ของโค้ดที่แก้ — (ชื่อ branch, ลิงก์ PR)

    push ให้ branch มาใน ref ส่วน PR ให้ทั้ง branch ต้นทางและลิงก์หน้า PR
    branch หลักไม่เก็บ เพราะลิงก์เทียบ diff ของ main กับตัวเองจะว่างเปล่า
    """
    default = (payload.get("repository") or {}).get("default_branch")

    if event == "push":
        ref = payload.get("ref") or ""
        branch = ref.removeprefix("refs/heads/") if ref.startswith("refs/heads/") else None
        return (None if branch == default else branch), None

    if event == "pull_request":
        pr = payload.get("pull_request") or {}
        branch = ((pr.get("head") or {}).get("ref")) or None
        return (None if branch == default else branch), pr.get("html_url")

    return None, None


def _target_status(event: str, payload: dict) -> str:
    """PR ที่ถูก merge = ผ่านการตรวจแล้ว -> ปิดงาน  ส่วน push ยังแค่ส่งเข้าคิวตรวจ

    การ merge เข้า main ทำได้เฉพาะคนที่ ruleset อนุญาต ซึ่งตั้งไว้ให้เป็นเจ้าของ repo
    การปิดงานอัตโนมัติจึงเท่ากับเจ้าของกดรับงานเอง
    """
    if event == "pull_request":
        pr = payload.get("pull_request") or {}
        if payload.get("action") == "closed" and pr.get("merged"):
            return "complete"
    return "review"


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


async def auto_join_projects(session: AsyncSession, member: Member) -> list[str]:
    """ใส่คนที่เพิ่งล็อกอินเข้าโปรเจคที่ผูกกับ repo ที่เขามีสิทธิ์ push

    ไม่งั้นคนที่ถูกเชิญเข้า repo แล้วมาล็อกอินเองจะเจอหน้าเปล่า
    ต้องรอเจ้าของโปรเจคกดดึง collaborator ให้ก่อนถึงจะเห็นอะไร

    เรียกทุกครั้งที่ล็อกอิน ไม่ใช่แค่ครั้งแรก จะได้รับ repo ที่เพิ่งถูกเชิญเข้าไปด้วย
    คืนชื่อโปรเจคที่เพิ่งเข้าไป (ว่างถ้าไม่มีอะไรเปลี่ยน)
    """
    if not member.github_token:
        return []

    try:
        rows = await _github_get(
            member.github_token,
            "https://api.github.com/user/repos",
            {"affiliation": "owner,collaborator,organization_member", "per_page": 100},
        )
    except HTTPException:
        # GitHub ล่มหรือ token หมดสิทธิ์ ก็ต้องล็อกอินผ่านอยู่ดี แค่ไม่ได้ auto-join
        return []

    repos = {r["full_name"] for r in rows if (r.get("permissions") or {}).get("push")}
    if not repos:
        return []

    joined: list[str] = []
    projects = await session.scalars(select(Project).where(Project.github_repo.in_(repos)))
    for project in projects:
        if member.id not in {m.id for m in project.members}:
            project.members.append(member)
            joined.append(project.name)

    if joined:
        await session.commit()
    return joined


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
    member: Member = Depends(require_member),
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
        out.append(
            CommitOut(
                sha=row["sha"][:7],
                message=message,
                author=(row.get("author") or {}).get("login")
                or row.get("commit", {}).get("author", {}).get("name", "unknown"),
                date=row.get("commit", {}).get("author", {}).get("date", ""),
                url=row.get("html_url", ""),
                task_ref=_read_ref(message),
            )
        )
    return out


@router.get("/events", response_model=list[WebhookEventOut])
async def events(
    limit: int = 20,
    _me: Member = Depends(require_member),
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
) -> dict[str, int | str]:
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
    rows = _summarize(x_github_event, payload)
    saved = [
        WebhookEvent(event=x_github_event, summary=summary, actor=actor, url=url, task_ref=ref)
        for summary, actor, url, ref in rows
    ]
    session.add_all(saved)
    await session.commit()

    repo = (payload.get("repository") or {}).get("full_name")
    refs = [ref for *_, ref in rows if ref]
    status = _target_status(x_github_event, payload)
    branch, review_url = _code_location(x_github_event, payload)
    moved = await _advance_referenced_tasks(session, repo, refs, status, branch, review_url)
    return {"saved": len(saved), "moved": moved, "status": status}


def _summarize(event: str, payload: dict) -> list[tuple[str, str | None, str | None, str | None]]:
    """แปลง payload ดิบให้เป็นบรรทัดสั้น ๆ ที่เอาไปแสดงได้เลย"""
    if event == "push":
        rows = []
        for commit in payload.get("commits", []):
            message = (commit.get("message") or "").split("\n")[0]
            rows.append(
                (
                    message,
                    (commit.get("author") or {}).get("username")
                    or (commit.get("author") or {}).get("name"),
                    commit.get("url"),
                    _read_ref(message),
                )
            )
        return rows

    if event == "pull_request":
        pr = payload.get("pull_request", {})
        action = payload.get("action", "")
        title = pr.get("title", "")
        # รหัสงานมักเขียนไว้ในรายละเอียด PR ("Closes KST-003") ไม่ใช่ในชื่อเสมอไป
        merged = " (merged)" if pr.get("merged") else ""
        return [
            (
                f"PR {action}{merged}: {title}",
                (pr.get("user") or {}).get("login"),
                pr.get("html_url"),
                _read_ref(title) or _read_ref(pr.get("body") or ""),
            )
        ]

    return [(f"event: {event}", (payload.get("sender") or {}).get("login"), None, None)]
