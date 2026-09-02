/** เรียก backend ผ่าน path สัมพัทธ์ — vite (dev) และ nginx (prod) proxy /api ให้อยู่แล้ว */

import type { Project, PriorityId, StatusId, Task } from "./types"


export type SubtaskSuggestion = {
  title: string
  category: string
  tags: string[]
  estimateHours: number
  complexity: "low" | "medium" | "high"
  reason: string
}

export type BreakdownResult = {
  summary: string
  subtasks: SubtaskSuggestion[]
  /** true = ยังไม่ได้ตั้ง GEMINI_API_KEY กำลังใช้ข้อมูลตัวอย่าง */
  mock: boolean
}

/** error จาก API ที่พก HTTP status มาด้วย เพื่อให้ฝั่งเรียกแยกได้ว่า 401 หรือพังจริง */
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

/** true เมื่อ error เกิดจากยังไม่ได้ล็อกอิน — ไม่ใช่ความผิดพลาดที่ต้องเตือน */
export const isUnauthorized = (e: unknown) => e instanceof ApiError && e.status === 401

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.detail === "string") return body.detail
  } catch {
    /* ไม่ใช่ JSON ก็ปล่อยไปใช้ข้อความมาตรฐาน */
  }
  return `เซิร์ฟเวอร์ตอบกลับ ${res.status}`
}

export async function breakdownTask(
  title: string,
  context: string,
  /** backend มีค่าเริ่มต้นให้อยู่แล้ว ส่งมาเฉพาะตอนอยากบังคับจำนวน */
  count?: number,
): Promise<BreakdownResult> {
  const res = await fetch("/api/ai/breakdown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(count === undefined ? { title, context } : { title, context, count }),
  })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

// ---------- projects & tasks ----------

type ApiTask = {
  id: string
  parentId: string | null
  title: string
  status: StatusId
  priority: PriorityId
  dueDate: string | null
  position: number
  assigneeIds: string[]
  category: string | null
  tags: string[]
  estimateHours: number | null
  complexity: "low" | "medium" | "high" | null
}

type ApiProject = {
  id: string
  name: string
  ownerId: string | null
  githubRepo: string | null
  memberIds: string[]
  tasks: ApiTask[]
}

const toTask = (t: ApiTask): Task => ({
  id: t.id,
  parentId: t.parentId,
  title: t.title,
  status: t.status,
  assigneeIds: t.assigneeIds,
  dueDate: t.dueDate,
  priority: t.priority,
  category: t.category,
  tags: t.tags,
  estimateHours: t.estimateHours,
  complexity: t.complexity,
})

const toProject = (p: ApiProject): Project => ({
  id: p.id,
  name: p.name,
  ownerId: p.ownerId,
  githubRepo: p.githubRepo,
  memberIds: p.memberIds,
  tasks: p.tasks.map(toTask),
})

export async function getProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects")
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return (await res.json()).map(toProject)
}

export async function createProject(name: string, githubRepo: string | null): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, githubRepo }),
  })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return toProject(await res.json())
}

export async function updateProject(id: string, patch: { name?: string }): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
}

export async function addProjectMember(projectId: string, memberId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, { method: "POST" })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
}

export async function removeProjectMember(projectId: string, memberId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, { method: "DELETE" })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
}

export type NewTask = {
  title: string
  status?: StatusId
  priority?: PriorityId
  dueDate?: string | null
  parentId?: string | null
  category?: string | null
  tags?: string[]
  estimateHours?: number | null
  complexity?: "low" | "medium" | "high" | null
}

export async function createTask(projectId: string, task: NewTask): Promise<Task> {
  const res = await fetch(`/api/projects/${projectId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return toTask(await res.json())
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "status" | "priority" | "dueDate" | "category">>,
): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
}

export async function setAssignee(taskId: string, memberId: string, on: boolean): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}/assignees/${memberId}`, {
    method: on ? "PUT" : "DELETE",
  })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
}

// ---------- auth ----------

export type AuthMember = {
  id: string
  name: string
  role: string
  color: string
  githubLogin: string | null
  avatarUrl: string | null
}

export type AuthStatus = {
  /** ตั้ง GITHUB_CLIENT_ID/SECRET แล้วหรือยัง */
  configured: boolean
  /** เปิดปุ่มเข้าสู่ระบบสำหรับทดสอบไว้หรือไม่ */
  devLogin: boolean
  member: AuthMember | null
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const res = await fetch("/api/auth/status")
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

export async function devLogin(): Promise<AuthMember> {
  const res = await fetch("/api/auth/dev-login", { method: "POST" })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

export async function updateMyRole(role: string): Promise<AuthMember> {
  const res = await fetch("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" })
}

// ---------- members ----------

export type ApiMember = {
  id: string
  name: string
  role: string
  color: string
  githubLogin: string | null
  avatarUrl: string | null
}

export async function getMembers(): Promise<ApiMember[]> {
  const res = await fetch("/api/members")
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

export async function createMemberApi(
  name: string,
  role: string,
  color: string,
): Promise<ApiMember> {
  const res = await fetch("/api/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, role, color }),
  })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

// ---------- ดึงรายชื่อจาก GitHub ----------

export type ImportResult = {
  org: string
  created: number
  updated: number
  /** คนที่ถูกเชิญแต่ยังไม่กดรับ (นับรวมใน created/updated แล้ว) */
  pending: number
  members: ApiMember[]
}

export type GithubRepo = { fullName: string; private: boolean }

export async function getMyRepos(): Promise<GithubRepo[]> {
  const res = await fetch("/api/github/repos")
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

export async function importRepoCollaborators(repo: string): Promise<ImportResult> {
  const res = await fetch(`/api/github/import-collaborators?repo=${encodeURIComponent(repo)}`, {
    method: "POST",
  })
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

// ---------- system ----------

export type SystemHealth = {
  apiOk: boolean
  databaseOk: boolean
  databaseError: string | null
  databaseKind: string
  aiReady: boolean
  aiModel: string
  authReady: boolean
  githubRepo: string | null
  webhookReady: boolean
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const res = await fetch("/api/system/health")
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

// ---------- github ----------

export type Commit = {
  sha: string
  message: string
  author: string
  date: string
  url: string
  taskRef: string | null
}

export type WebhookEvent = {
  id: string
  event: string
  summary: string
  actor: string | null
  url: string | null
  taskRef: string | null
  receivedAt: string
}

export async function getCommits(limit = 8): Promise<Commit[]> {
  const res = await fetch(`/api/github/commits?limit=${limit}`)
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}

export async function getWebhookEvents(limit = 10): Promise<WebhookEvent[]> {
  const res = await fetch(`/api/github/events?limit=${limit}`)
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return res.json()
}
