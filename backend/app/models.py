"""ตาราง 5 ตัว: members, projects, tasks + ตารางเชื่อม 2 ตัว

สถานะกับความสำคัญเก็บเป็น string ไม่ได้ใช้ ENUM ของ postgres
เพราะ ENUM แก้ทีหลังต้องเขียน migration เอง ส่วนการตรวจค่าให้ pydantic ทำแทน
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import (
    JSON,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app import crypto


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


# ---------- ตารางเชื่อม ----------

project_members = Table(
    "project_members",
    Base.metadata,
    Column("project_id", ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("member_id", ForeignKey("members.id", ondelete="CASCADE"), primary_key=True),
)

task_assignees = Table(
    "task_assignees",
    Base.metadata,
    Column("task_id", ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("member_id", ForeignKey("members.id", ondelete="CASCADE"), primary_key=True),
)


# ---------- ตารางหลัก ----------

class Member(Base):
    __tablename__ = "members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120))
    #: ตำแหน่งงาน — GitHub ไม่มีข้อมูลนี้ ต้องกรอกเอง
    role: Mapped[str] = mapped_column(String(60), default="Member")
    #: สีพื้นหลังของ avatar เช่น #7b68ee (ใช้เมื่อไม่มี avatar_url)
    color: Mapped[str] = mapped_column(String(9))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    # --- ข้อมูลจาก GitHub (มีเฉพาะคนที่ login เข้ามา) ---
    github_id: Mapped[str | None] = mapped_column(String(40), unique=True, nullable=True)
    github_login: Mapped[str | None] = mapped_column(String(80), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    #: access token ของ GitHub — เก็บไว้เรียก API ทีหลัง (เช่น ดึงรายชื่อสมาชิก org)
    #: หมายเหตุความปลอดภัย: เก็บเป็น plaintext ตอน dev
    #: ก่อนขึ้น production ควรเข้ารหัสก่อนบันทึก
    #: เก็บเป็นค่าที่เข้ารหัสแล้ว — อ่าน/เขียนผ่าน property `token` เท่านั้น
    github_token: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def token(self) -> str | None:
        """access token ของ GitHub แบบถอดรหัสแล้ว"""
        return crypto.decrypt(self.github_token)

    @token.setter
    def token(self, value: str | None) -> None:
        self.github_token = crypto.encrypt(value)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(160))
    #: repo บน GitHub ที่โปรเจคนี้ผูกอยู่ เช่น "kongzell/Follow-up"
    github_repo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    #: รหัสย่อที่ใช้นำหน้าเลขงาน เช่น "KST" -> KST-001
    #: ตั้งจากชื่อ repo ตอนสร้าง แล้วเจ้าของแก้เองได้
    task_prefix: Mapped[str] = mapped_column(String(10), default="TASK")
    #: คนที่สร้างโปรเจค — ลบ/เปลี่ยนชื่อโปรเจคได้คนเดียว
    #: null ได้เพื่อไม่ให้โปรเจคหายตามเจ้าของที่ถูกลบ (ON DELETE SET NULL)
    owner_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    members: Mapped[list[Member]] = relationship(secondary=project_members, lazy="selectin")
    tasks: Mapped[list[Task]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Task.position",
        lazy="selectin",
    )


class Task(Base):
    __tablename__ = "tasks"
    #: เลขงานห้ามซ้ำในโปรเจคเดียวกัน ไม่งั้น commit อ้างถึงแล้วไม่รู้ว่าใบไหน
    __table_args__ = (UniqueConstraint("project_id", "number", name="uq_tasks_project_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    #: เลขงานในโปรเจค เริ่มที่ 1 — ประกอบกับ task_prefix เป็นรหัสอย่าง KST-001
    number: Mapped[int] = mapped_column(Integer)
    #: งานแม่ — งานที่ AI แตกให้จะชี้กลับมาที่หัวข้อกว้าง ๆ ที่ผู้ใช้พิมพ์
    parent_id: Mapped[str | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="todo")
    priority: Mapped[str] = mapped_column(String(20), default="none")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    #: ลำดับการ์ดในคอลัมน์ — เป็น float เพื่อให้แทรกระหว่างสองใบได้โดยไม่ต้องเรียงใหม่ทั้งคอลัมน์
    position: Mapped[float] = mapped_column(Float, default=1000.0)

    # --- ฟิลด์ที่ AI เติมให้ (ผู้ใช้แก้เองได้) ---
    #: Frontend / Backend / Database / ... — ใช้เป็นคอลัมน์ได้เมื่อจัดกลุ่มตามหมวดหมู่
    category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    #: branch ล่าสุดที่มี commit อ้างถึงงานนี้ ใช้ลิงก์ไปดู diff บน GitHub
    branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    #: ลิงก์ PR ล่าสุดที่อ้างถึงงานนี้ — ดีกว่า branch เพราะเห็นรีวิวด้วย
    review_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: ทักษะ/เครื่องมือที่ต้องใช้ เก็บเป็น JSON array
    #: ปล่อยให้เป็น NULL ได้ เพราะ sqlite เพิ่มคอลัมน์ NOT NULL ที่ไม่มี default ไม่ได้
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True, default=list)
    estimate_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    complexity: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    project: Mapped[Project] = relationship(back_populates="tasks")
    assignees: Mapped[list[Member]] = relationship(secondary=task_assignees, lazy="selectin")


class WebhookEvent(Base):
    """เก็บ event ที่ GitHub ยิงเข้ามา ไว้แสดงใน Webhook Log ฝั่งขวา"""

    __tablename__ = "webhook_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    #: ชนิด event จาก header X-GitHub-Event เช่น push, pull_request
    event: Mapped[str] = mapped_column(String(40))
    #: ข้อความสรุปที่เอาไปแสดงตรง ๆ
    summary: Mapped[str] = mapped_column(Text)
    actor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: รหัสงานที่อ่านได้จากข้อความ commit เช่น TASK-001
    task_ref: Mapped[str | None] = mapped_column(String(40), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
