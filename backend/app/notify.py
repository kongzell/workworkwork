"""ข้อความแจ้งเตือนของแต่ละเหตุการณ์

แยกจาก mailer.py เพราะที่นั่นรู้แค่วิธีส่ง ไม่รู้จักงานหรือโปรเจค
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Member, Project, Task, project_members


async def project_emails(
    session: AsyncSession, project_id: str, exclude: set[str]
) -> list[str]:
    """อีเมลของสมาชิกในโปรเจค ยกเว้นคนที่ระบุ

    คนที่ไม่ได้กรอกอีเมลไว้จะไม่ถูกนับ — ถือว่าเลือกไม่รับแจ้งเตือน
    """
    rows = await session.scalars(
        select(Member.email)
        .join(project_members, project_members.c.member_id == Member.id)
        .where(
            project_members.c.project_id == project_id,
            Member.email.is_not(None),
            Member.id.not_in(exclude) if exclude else Member.id.is_not(None),
        )
    )
    return [e for e in rows if e]


async def emails_of(session: AsyncSession, member_ids: set[str | None]) -> list[str]:
    """อีเมลของคนตาม id ที่ให้มา — ข้ามคนที่ไม่ได้กรอกอีเมลไว้"""
    ids = {m for m in member_ids if m}
    if not ids:
        return []
    rows = await session.scalars(
        select(Member.email).where(Member.id.in_(ids), Member.email.is_not(None))
    )
    return [e for e in rows if e]


def _task_key(project: Project, task: Task) -> str:
    return f"{project.task_prefix}-{task.number:03d}"


def _footer(project: Project) -> str:
    url = get_settings().app_url
    return (
        f"\n\nเปิดบอร์ด: {url}\n"
        f"\n--\n"
        f"อีเมลนี้ส่งอัตโนมัติจากระบบ Follow-up ({project.name})\n"
        f"ไม่อยากรับแล้ว ลบอีเมลออกจากเมนูโปรไฟล์ในเว็บได้เลย"
    )


def task_created(project: Project, task: Task, author: Member) -> tuple[str, str]:
    key = _task_key(project, task)
    subject = f"[{project.name}] งานใหม่ {key} — {task.title}"

    lines = [
        f"{author.name} เพิ่มงานใหม่เข้าบอร์ด",
        "",
        f"  {key}  {task.title}",
    ]
    if task.category:
        lines.append(f"  หมวดหมู่: {task.category}")
    if task.estimate_hours:
        lines.append(f"  เวลาที่ประเมิน: {task.estimate_hours} ชม.")
    if task.due_date:
        lines.append(f"  กำหนดส่ง: {task.due_date}")
    if task.description:
        lines += ["", "รายละเอียด:", task.description]

    return subject, "\n".join(lines) + _footer(project)


def task_claimed(project: Project, task: Task, who: Member) -> tuple[str, str]:
    key = _task_key(project, task)
    subject = f"[{project.name}] {who.name} รับงาน {key} แล้ว"

    body = "\n".join([
        f"{who.name} รับงานใบนี้ไปทำแล้ว การ์ดย้ายไปคอลัมน์ \"กำลังทำ\"",
        "",
        f"  {key}  {task.title}",
    ])
    return subject, body + _footer(project)
