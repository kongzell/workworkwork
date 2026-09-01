from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Member, Project, Task, project_members, task_assignees
from app.schemas import ProjectCreate, ProjectOut, TaskCreate, TaskOut
from app.serialize import project_out, task_out

router = APIRouter(prefix="/api/projects", tags=["projects"])


async def _get_project(session: AsyncSession, project_id: str) -> Project:
    project = await session.get(Project, project_id)
    if project is None:
        raise HTTPException(404, f"ไม่พบโปรเจค {project_id}")
    return project


@router.get("", response_model=list[ProjectOut])
async def list_projects(session: AsyncSession = Depends(get_session)) -> list[ProjectOut]:
    rows = await session.scalars(select(Project).order_by(Project.created_at))
    return [project_out(p) for p in rows]


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(
    payload: ProjectCreate,
    session: AsyncSession = Depends(get_session),
) -> ProjectOut:
    project = Project(name=payload.name)
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project_out(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, session: AsyncSession = Depends(get_session)) -> None:
    project = await _get_project(session, project_id)
    await session.delete(project)
    await session.commit()


# ---------- พนักงานในโปรเจค ----------

@router.post("/{project_id}/members/{member_id}", status_code=204)
async def add_member(
    project_id: str,
    member_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    project = await _get_project(session, project_id)
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
    session: AsyncSession = Depends(get_session),
) -> None:
    """เอาออกจากโปรเจค + ถอด assign ออกจากทุกงานของโปรเจคนี้ (งานโปรเจคอื่นไม่แตะ)"""
    await _get_project(session, project_id)

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
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    await _get_project(session, project_id)

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
