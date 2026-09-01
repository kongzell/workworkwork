/** เรียก backend ผ่าน path สัมพัทธ์ — vite (dev) และ nginx (prod) proxy /api ให้อยู่แล้ว */

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

export type AiStatus = { ready: boolean; mock: boolean; model: string }

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.detail === "string") return body.detail
  } catch {
    /* ไม่ใช่ JSON ก็ปล่อยไปใช้ข้อความมาตรฐาน */
  }
  return `เซิร์ฟเวอร์ตอบกลับ ${res.status}`
}

export async function getAiStatus(): Promise<AiStatus> {
  const res = await fetch("/api/ai/status")
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
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
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
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
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function devLogin(): Promise<AuthMember> {
  const res = await fetch("/api/auth/dev-login", { method: "POST" })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function updateMyRole(role: string): Promise<AuthMember> {
  const res = await fetch("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) throw new Error(await readError(res))
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
  if (!res.ok) throw new Error(await readError(res))
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
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

// ---------- ดึงรายชื่อจาก GitHub ----------

export type GithubOrg = { login: string; avatarUrl: string | null }

export type ImportResult = {
  org: string
  created: number
  updated: number
  members: ApiMember[]
}

export async function getMyOrgs(): Promise<GithubOrg[]> {
  const res = await fetch("/api/github/orgs")
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export type GithubRepo = { fullName: string; private: boolean }

export async function importOrgMembers(org: string): Promise<ImportResult> {
  const res = await fetch(`/api/github/import-members?org=${encodeURIComponent(org)}`, {
    method: "POST",
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function getMyRepos(): Promise<GithubRepo[]> {
  const res = await fetch("/api/github/repos")
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function importRepoCollaborators(repo: string): Promise<ImportResult> {
  const res = await fetch(`/api/github/import-collaborators?repo=${encodeURIComponent(repo)}`, {
    method: "POST",
  })
  if (!res.ok) throw new Error(await readError(res))
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
  if (!res.ok) throw new Error(await readError(res))
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
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function getWebhookEvents(limit = 10): Promise<WebhookEvent[]> {
  const res = await fetch(`/api/github/events?limit=${limit}`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}
