from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Member, Task
from app.schemas import TaskOut, TaskUpdate
from app.serialize import task_out

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


async def _get_task(session: AsyncSession, task_id: str) -> Task:
    task = await session.get(Task, task_id)
    if task is None:
        raise HTTPException(404, f"ไม่พบงาน {task_id}")
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    task = await _get_task(session, task_id)
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
async def delete_task(task_id: str, session: AsyncSession = Depends(get_session)) -> None:
    task = await _get_task(session, task_id)
    await session.delete(task)
    await session.commit()


@router.put("/{task_id}/assignees/{member_id}", response_model=TaskOut)
async def assign(
    task_id: str,
    member_id: str,
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    task = await _get_task(session, task_id)
    member = await session.get(Member, member_id)
    if member is None:
        raise HTTPException(404, f"ไม่พบพนักงาน {member_id}")
    if member.id not in {m.id for m in task.assignees}:
        task.assignees.append(member)
        await session.commit()
        await session.refresh(task)
    return task_out(task)


@router.delete("/{task_id}/assignees/{member_id}", response_model=TaskOut)
async def unassign(
    task_id: str,
    member_id: str,
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    task = await _get_task(session, task_id)
    task.assignees = [m for m in task.assignees if m.id != member_id]
    await session.commit()
    await session.refresh(task)
    return task_out(task)
