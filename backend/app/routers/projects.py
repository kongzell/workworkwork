from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_member
from app.db import get_session
from app.models import Member, Project, Task, project_members, task_assignees
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate, TaskCreate, TaskOut
from app.serialize import project_out, task_out

router = APIRouter(prefix="/api/projects", tags=["projects"])


async def _get_project(session: AsyncSession, project_id: str, me: Member) -> Project:
    """โปรเจคที่ me เป็นสมาชิกอยู่

    ถ้าไม่ได้เป็นสมาชิกจะตอบ 404 เหมือนไม่มีโปรเจคนี้ ไม่ใช่ 403
    เพราะ 403 เท่ากับบอกคนนอกว่า id นี้มีอยู่จริง
    """
    project = await session.get(Project, project_id)
    if project is None or me.id not in {m.id for m in project.members}:
        raise HTTPException(404, f"ไม่พบโปรเจค {project_id}")
    return project


async def _get_owned_project(session: AsyncSession, project_id: str, me: Member) -> Project:
    """โปรเจคที่ me เป็นเจ้าของ — ใช้กับงานที่กระทบทั้งโปรเจค เช่น ลบ เปลี่ยนชื่อ จัดการสมาชิก"""
    project = await _get_project(session, project_id, me)
    if project.owner_id != me.id:
        raise HTTPException(403, "เฉพาะเจ้าของโปรเจคเท่านั้นที่ทำรายการนี้ได้")
    return project


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> list[ProjectOut]:
    """เฉพาะโปรเจคที่ตัวเองเป็นสมาชิก"""
    rows = await session.scalars(
        select(Project)
        .join(project_members, project_members.c.project_id == Project.id)
        .where(project_members.c.member_id == me.id)
        .order_by(Project.created_at)
    )
    return [project_out(p) for p in rows]


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(
    payload: ProjectCreate,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> ProjectOut:
    """คนสร้างเป็นเจ้าของ และถูกใส่เป็นสมาชิกไปด้วย ไม่งั้นจะมองไม่เห็นโปรเจคที่ตัวเองเพิ่งสร้าง"""
    project = Project(name=payload.name, github_repo=payload.github_repo, owner_id=me.id)
    project.members.append(me)
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project_out(project)


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> ProjectOut:
    project = await _get_owned_project(session, project_id, me)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(project, field, value)
    await session.commit()
    await session.refresh(project)
    return project_out(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> None:
    project = await _get_owned_project(session, project_id, me)
    await session.delete(project)
    await session.commit()


# ---------- พนักงานในโปรเจค ----------

@router.post("/{project_id}/members/{member_id}", status_code=204)
async def add_member(
    project_id: str,
    member_id: str,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> None:
    project = await _get_owned_project(session, project_id, me)
    member = await session.get(Member, member_id)
    if member is None:
        raise HTTPException(404, f"ไม่พบพนักงาน {member_id}")
    if member.id not in {m.id for m in project.members}:
        project.members.append(member)
        await session.commit()


@router.delete("/{project_id}/members/{member_id}", status_code=204)
async def remove_member(
    project_id: str,
    member_id: str,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> None:
    """เอาออกจากโปรเจค + ถอด assign ออกจากทุกงานของโปรเจคนี้ (งานโปรเจคอื่นไม่แตะ)"""
    project = await _get_owned_project(session, project_id, me)
    if member_id == project.owner_id:
        raise HTTPException(400, "เอาเจ้าของโปรเจคออกไม่ได้")

    await session.execute(
        delete(task_assignees).where(
            task_assignees.c.member_id == member_id,
            task_assignees.c.task_id.in_(select(Task.id).where(Task.project_id == project_id)),
        )
    )
    await session.execute(
        delete(project_members).where(
            project_members.c.project_id == project_id,
            project_members.c.member_id == member_id,
        )
    )
    await session.commit()


# ---------- งานในโปรเจค ----------

@router.post("/{project_id}/tasks", response_model=TaskOut, status_code=201)
async def create_task(
    project_id: str,
    payload: TaskCreate,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    await _get_project(session, project_id, me)

    # วางต่อท้ายคอลัมน์ที่ระบุ
    last = await session.scalar(
        select(func.max(Task.position)).where(
            Task.project_id == project_id, Task.status == payload.status
        )
    )
    task = Task(
        project_id=project_id,
        parent_id=payload.parent_id,
        title=payload.title,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
        position=(last or 0.0) + 1000.0,
        category=payload.category,
        tags=payload.tags,
        estimate_hours=payload.estimate_hours,
        complexity=payload.complexity,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task_out(task)
