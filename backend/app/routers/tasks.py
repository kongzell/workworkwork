from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_member
from app.db import get_session
from app.models import Member, Project, Task, project_members
from app.schemas import TaskOut, TaskUpdate
from app.serialize import task_out

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

#: ฟิลด์ที่สมาชิกธรรมดาแก้ได้ — ที่เหลือเป็นการวางแผนงาน ซึ่งเป็นเรื่องของเจ้าของ
MEMBER_EDITABLE = {"status", "position"}


async def _task_with_project(
    session: AsyncSession, task_id: str, me: Member
) -> tuple[Task, Project]:
    """งาน + โปรเจคของมัน เมื่อ me เป็นสมาชิกอยู่ — คนนอกได้ 404 เหมือนไม่มีงานนี้"""
    task = await session.get(Task, task_id)
    if task is None:
        raise HTTPException(404, f"ไม่พบงาน {task_id}")

    project = await session.scalar(
        select(Project)
        .join(project_members, project_members.c.project_id == Project.id)
        .where(Project.id == task.project_id, project_members.c.member_id == me.id)
    )
    if project is None:
        raise HTTPException(404, f"ไม่พบงาน {task_id}")
    return task, project


async def _park_if_unclaimed(session: AsyncSession, task: Task) -> None:
    """งานที่ไม่มีใครถืออยู่แล้ว ให้กลับไปคอลัมน์ "รอเริ่ม"

    เป็นขากลับของกฎ "รับงานแล้วย้ายไปกำลังทำ" ไม่งั้นจะเหลือการ์ดค้างอยู่
    คอลัมน์กำลังทำโดยไม่มีใครทำ ซึ่งอ่านบอร์ดแล้วเข้าใจผิด

    ไม่แตะงานที่ส่งตรวจหรือปิดไปแล้ว เพราะงานถูกทำไปจริง
    """
    if task.assignees or task.status != "in-progress":
        return

    task.status = "todo"
    # ต่อท้ายคอลัมน์ปลายทาง เหมือนตอนย้ายด้วยวิธีอื่น
    last = await session.scalar(
        select(func.max(Task.position)).where(
            Task.project_id == task.project_id, Task.status == "todo"
        )
    )
    task.position = (last or 0.0) + 1000.0


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    task, project = await _task_with_project(session, task_id, me)
    data = payload.model_dump(exclude_unset=True)

    # สมาชิกย้ายคอลัมน์งานที่ตัวเองทำได้ แต่เปลี่ยนชื่อ ความสำคัญ หมวดหมู่ ไม่ได้
    if project.owner_id != me.id:
        blocked = sorted(set(data) - MEMBER_EDITABLE)
        if blocked:
            raise HTTPException(
                403, f"เฉพาะเจ้าของโปรเจคที่แก้ได้: {', '.join(blocked)}"
            )
        # ปิดงานคือการตรวจรับ ซึ่งเป็นหน้าที่เจ้าของ สมาชิกส่งได้แค่ถึงรอตรวจ
        if data.get("status") == "complete":
            raise HTTPException(
                403, "ส่งงานไปรอตรวจได้ แต่การปิดงานเป็นของเจ้าของโปรเจค"
            )

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
    task, project = await _task_with_project(session, task_id, me)
    if project.owner_id != me.id:
        raise HTTPException(403, "เฉพาะเจ้าของโปรเจคเท่านั้นที่ลบงานได้")
    await session.delete(task)
    await session.commit()


@router.put("/{task_id}/assignees/{member_id}", response_model=TaskOut)
async def assign(
    task_id: str,
    member_id: str,
    me: Member = Depends(require_member),
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    task, project = await _task_with_project(session, task_id, me)

    # สมาชิกรับงานเข้าตัวเองได้ แต่มอบหมายให้คนอื่นเป็นเรื่องของเจ้าของ
    if project.owner_id != me.id and member_id != me.id:
        raise HTTPException(403, "เฉพาะเจ้าของโปรเจคเท่านั้นที่มอบหมายงานให้คนอื่นได้")

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
    task, project = await _task_with_project(session, task_id, me)
    if project.owner_id != me.id and member_id != me.id:
        raise HTTPException(403, "เฉพาะเจ้าของโปรเจคเท่านั้นที่ถอดคนอื่นออกจากงานได้")

    task.assignees = [m for m in task.assignees if m.id != member_id]
    await _park_if_unclaimed(session, task)
    await session.commit()
    await session.refresh(task)
    return task_out(task)
