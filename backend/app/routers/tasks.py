from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_member
from app.db import get_session
from app.models import Member, Project, Task, project_members
from app.schemas import TaskOut, TaskUpdate
from app.serialize import task_out

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


async def _get_task(session: AsyncSession, task_id: str, me: Member) -> Task:
    """งานที่อยู่ในโปรเจคที่ me เป็นสมาชิก — คนนอกได้ 404 เหมือนไม่มีงานนี้"""
    task = await session.get(Task, task_id)
    if task is None:
        raise HTTPException(404, f"ไม่พบงาน {task_id}")

    allowed = await session.scalar(
        select(Project.id)
        .join(project_members, project_members.c.project_id == Project.id)
        .where(Project.id == task.project_id, project_members.c.member_id == me.id)
    )
    if allowed is None:
        raise HTTPException(404, f"ไม่พบงาน {task_id}")
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    task = await _get_task(session, task_id, me)
    data = payload.model_dump(exclude_unset=True)

    # ย้ายคอลัมน์แล้วไม่ได้สั่งลำดับมาด้วย -> ต่อท้ายคอลัมน์ปลายทาง
    if "status" in data and data["status"] != task.status and "position" not in data:
        last = await session.scalar(
            select(func.max(Task.position)).where(
                Task.project_id == task.project_id, Task.status == data["status"]
            )
        )
        data["position"] = (last or 0.0) + 1000.0

    for field, value in data.items():
        setattr(task, field, value)

    await session.commit()
    await session.refresh(task)
    return task_out(task)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> None:
    task = await _get_task(session, task_id, me)
    await session.delete(task)
    await session.commit()


@router.put("/{task_id}/assignees/{member_id}", response_model=TaskOut)
async def assign(
    task_id: str,
    member_id: str,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    task = await _get_task(session, task_id, me)
    member = await session.get(Member, member_id)
    if member is None:
        raise HTTPException(404, f"ไม่พบพนักงาน {member_id}")

    # มอบหมายได้เฉพาะคนที่อยู่ในโปรเจคนี้ ไม่งั้นจะโผล่ชื่อคนนอกบนการ์ด
    in_project = await session.scalar(
        select(project_members.c.member_id).where(
            project_members.c.project_id == task.project_id,
            project_members.c.member_id == member_id,
        )
    )
    if in_project is None:
        raise HTTPException(400, "คนนี้ยังไม่ได้อยู่ในโปรเจคนี้")

    if member.id not in {m.id for m in task.assignees}:
        task.assignees.append(member)
        await session.commit()
        await session.refresh(task)
    return task_out(task)


@router.delete("/{task_id}/assignees/{member_id}", response_model=TaskOut)
async def unassign(
    task_id: str,
    member_id: str,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    task = await _get_task(session, task_id, me)
    task.assignees = [m for m in task.assignees if m.id != member_id]
    await session.commit()
    await session.refresh(task)
    return task_out(task)
