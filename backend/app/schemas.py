"""รูปแบบ JSON ที่คุยกับ frontend

ใช้ alias เป็น camelCase ให้ตรงกับ types.ts ฝั่ง React (assigneeIds, dueDate)
โดยที่ฝั่ง Python ยังเขียน snake_case ตามปกติ
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

StatusId = Literal["todo", "in-progress", "review", "complete"]
PriorityId = Literal["urgent", "high", "normal", "low", "none"]
Complexity = Literal["low", "medium", "high"]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------- members ----------

class MemberCreate(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    role: str = Field(default="Member", max_length=60)
    color: str = Field(default="#7b68ee", pattern=r"^#[0-9a-fA-F]{6}$")


class MemberUpdate(ApiModel):
    """แก้ข้อมูลของตัวเอง — ตอนนี้มีแค่บทบาทกับสี"""

    role: str | None = Field(default=None, min_length=1, max_length=60)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")


class MemberOut(ApiModel):
    id: str
    name: str
    role: str
    color: str
    github_login: str | None = None
    avatar_url: str | None = None


# ---------- tasks ----------

class TaskCreate(ApiModel):
    title: str = Field(min_length=1)
    parent_id: str | None = None
    status: StatusId = "todo"
    priority: PriorityId = "none"
    due_date: date | None = None
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    estimate_hours: float | None = None
    complexity: Complexity | None = None


class TaskUpdate(ApiModel):
    """ทุกฟิลด์ไม่บังคับ — ส่งมาเฉพาะอันที่จะแก้"""

    title: str | None = Field(default=None, min_length=1)
    status: StatusId | None = None
    priority: PriorityId | None = None
    due_date: date | None = None
    position: float | None = None
    category: str | None = None
    tags: list[str] | None = None
    estimate_hours: float | None = None
    complexity: Complexity | None = None


class TaskOut(ApiModel):
    id: str
    parent_id: str | None
    title: str
    status: StatusId
    priority: PriorityId
    due_date: date | None
    position: float
    assignee_ids: list[str]
    category: str | None
    tags: list[str]
    estimate_hours: float | None
    complexity: Complexity | None


# ---------- projects ----------

class ProjectCreate(ApiModel):
    name: str = Field(min_length=1, max_length=160)
    github_repo: str | None = Field(default=None, max_length=200)


class ProjectUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    github_repo: str | None = Field(default=None, max_length=200)


class ProjectOut(ApiModel):
    owner_id: str | None = None
    id: str
    name: str
    github_repo: str | None
    member_ids: list[str]
    tasks: list[TaskOut]


# ---------- AI ----------

class BreakdownRequest(ApiModel):
    title: str = Field(min_length=1, max_length=300)
    context: str = Field(default="", max_length=1000)
    count: int = Field(default=5, ge=2, le=12)


class SubtaskSuggestion(ApiModel):
    title: str
    category: str
    tags: list[str] = Field(default_factory=list)
    estimate_hours: float
    complexity: Complexity
    reason: str = ""


class BreakdownResult(ApiModel):
    summary: str
    subtasks: list[SubtaskSuggestion]
    #: true เมื่อยังไม่ได้ตั้ง API key และกำลังใช้ข้อมูลตัวอย่าง
    mock: bool = False


# ---------- auth ----------

class AuthStatus(ApiModel):
    #: ตั้ง GITHUB_CLIENT_ID/SECRET แล้วหรือยัง
    configured: bool
    #: เปิด /api/auth/dev-login ให้ใช้อยู่หรือไม่
    dev_login: bool
    member: MemberOut | None = None


# ---------- github ----------

class CommitOut(ApiModel):
    sha: str
    message: str
    author: str
    date: str
    url: str
    task_ref: str | None = None


class WebhookEventOut(ApiModel):
    id: str
    event: str
    summary: str
    actor: str | None
    url: str | None
    task_ref: str | None
    received_at: datetime


class GithubRepo(ApiModel):
    full_name: str
    private: bool
    collaborator_count: int | None = None


class ImportResult(ApiModel):
    #: ชื่อ org หรือ repo ที่ดึงมา
    org: str
    #: จำนวนคนที่เพิ่งสร้างใหม่
    created: int
    #: จำนวนคนที่มีอยู่แล้ว อัปเดตข้อมูลให้
    updated: int
    #: จำนวนคนที่ถูกเชิญแต่ยังไม่กดรับ (นับรวมอยู่ใน created/updated แล้ว)
    pending: int = 0
    members: list[MemberOut]


# ---------- system ----------

class SystemHealth(ApiModel):
    api_ok: bool
    database_ok: bool
    database_error: str | None
    database_kind: str
    ai_ready: bool
    ai_model: str
    auth_ready: bool
    github_repo: str | None
    webhook_ready: bool
