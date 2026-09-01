"""ใส่พนักงานตั้งต้น — ไม่สร้างโปรเจคตัวอย่างแล้ว

    python -m app.seed

รันซ้ำได้ ถ้ามีข้อมูลอยู่แล้วจะไม่ทำอะไร (เว้นแต่สั่ง --reset)
"""

import asyncio
import sys

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Member, Project

MEMBERS = [
    ("m1", "Netithon Laohapan", "Fullstack", "#7b68ee"),
    ("m2", "Somchai Jaidee", "Backend", "#3b82f6"),
    ("m3", "Malee Kaewta", "Design", "#ec4899"),
]

async def seed(reset: bool = False) -> None:
    async with SessionLocal() as session:
        if reset:
            for project in await session.scalars(select(Project)):
                await session.delete(project)
            for member in await session.scalars(select(Member)):
                await session.delete(member)
            await session.commit()

        existing = await session.scalar(select(func.count()).select_from(Member))
        if existing:
            print(f"มีพนักงานอยู่แล้ว ({existing} คน) — ข้าม ใช้ --reset เพื่อล้างก่อน")
            return

        session.add_all(
            Member(id=mid, name=n, role=r, color=c) for mid, n, r, c in MEMBERS
        )
        await session.commit()
        print(f"ใส่พนักงานแล้ว {len(MEMBERS)} คน (ไม่ได้สร้างโปรเจคตัวอย่าง)")


if __name__ == "__main__":
    # console ของ Windows ปกติเป็น cp1252 พิมพ์ภาษาไทยแล้วพัง
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    asyncio.run(seed(reset="--reset" in sys.argv))
