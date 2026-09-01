"""ใส่ข้อมูลตั้งต้นให้ตรงกับที่ frontend เคยฮาร์ดโค้ดไว้

    python -m app.seed

รันซ้ำได้ ถ้ามีข้อมูลอยู่แล้วจะไม่ทำอะไร (เว้นแต่สั่ง --reset)
"""

import asyncio
import sys
from datetime import date

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Member, Project, Task

MEMBERS = [
    ("m1", "Netithon Laohapan", "Fullstack", "#7b68ee"),
    ("m2", "Somchai Jaidee", "Backend", "#3b82f6"),
    ("m3", "Malee Kaewta", "Design", "#ec4899"),
]

# (title, status, priority, due_date, assignee_ids)
P1_TASKS = [
    ("ตรวจสิทธิ์ผู้ใช้แต่ละบทบาท", "todo", "none", date(2026, 9, 12), ["m1"]),
    ("ทำหน้า Report รายสัปดาห์", "todo", "none", None, []),
    ("เขียนเอกสารส่งมอบ", "todo", "none", None, []),
    ("ออกแบบหน้า Login", "in-progress", "urgent", date(2026, 9, 5), ["m3"]),
    ("เชื่อม API รายชื่อพนักงาน", "in-progress", "normal", date(2026, 9, 8), ["m2"]),
    ("ตั้งค่า Docker ให้ทีม", "complete", "none", date(2026, 8, 28), ["m1"]),
]

P2_TASKS = [
    ("ออกแบบโลโก้ใหม่", "in-progress", "high", date(2026, 9, 5), ["m3"]),
    ("เตรียมสไลด์นำเสนอ", "todo", "normal", None, []),
    ("สรุปงบประมาณ", "complete", "low", None, ["m1"]),
]


async def seed(reset: bool = False) -> None:
    async with SessionLocal() as session:
        if reset:
            for project in await session.scalars(select(Project)):
                await session.delete(project)
            for member in await session.scalars(select(Member)):
                await session.delete(member)
            await session.commit()

        existing = await session.scalar(select(func.count()).select_from(Project))
        if existing:
            print(f"มีข้อมูลอยู่แล้ว ({existing} โปรเจค) — ข้าม ใช้ --reset เพื่อล้างก่อน")
            return

        members = {mid: Member(id=mid, name=n, role=r, color=c) for mid, n, r, c in MEMBERS}
        session.add_all(members.values())

        for name, rows, member_ids in [
            ("Project 1", P1_TASKS, ["m1", "m2", "m3"]),
            ("Project 2", P2_TASKS, ["m1", "m3"]),
        ]:
            project = Project(name=name)
            project.members = [members[i] for i in member_ids]
            for index, (title, status, priority, due, assignees) in enumerate(rows):
                task = Task(
                    title=title,
                    status=status,
                    priority=priority,
                    due_date=due,
                    position=(index + 1) * 1000.0,
                )
                task.assignees = [members[i] for i in assignees]
                project.tasks.append(task)
            session.add(project)

        await session.commit()
        print(f"ใส่ข้อมูลแล้ว: {len(members)} พนักงาน, 2 โปรเจค, {len(P1_TASKS) + len(P2_TASKS)} งาน")


if __name__ == "__main__":
    # console ของ Windows ปกติเป็น cp1252 พิมพ์ภาษาไทยแล้วพัง
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    asyncio.run(seed(reset="--reset" in sys.argv))
