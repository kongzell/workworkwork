export type StatusId = "todo" | "in-progress" | "complete"

export type PriorityId = "urgent" | "high" | "normal" | "low" | "none"

export type Complexity = "low" | "medium" | "high"

export type Member = {
  id: string
  name: string
  role: string
  /** สีพื้นหลังของ avatar */
  color: string
}

export type Task = {
  id: string
  /** งานย่อยที่ AI แตกให้จะชี้กลับมาที่งานแม่ — งานแม่เท่านั้นที่ขึ้นบนบอร์ด */
  parentId: string | null
  title: string
  status: StatusId
  /** id ของพนักงานที่ถูก assign (ดึงจาก members ของโปรเจค) */
  assigneeIds: string[]
  dueDate: string | null
  priority: PriorityId
  /** ฟิลด์ด้านล่างนี้ AI เติมให้ตอนแตกงาน แต่แก้เองได้ */
  category: string | null
  tags: string[]
  estimateHours: number | null
  complexity: Complexity | null
}

export type Project = {
  id: string
  name: string
  tasks: Task[]
  memberIds: string[]
}

export const STATUSES: { id: StatusId; label: string; color: string }[] = [
  { id: "todo", label: "รอเริ่ม", color: "var(--status-todo)" },
  { id: "in-progress", label: "กำลังทำ", color: "var(--status-progress)" },
  { id: "complete", label: "เสร็จแล้ว", color: "var(--status-complete)" },
]

export const PRIORITIES: { id: PriorityId; label: string; color: string }[] = [
  { id: "urgent", label: "ด่วน", color: "var(--danger)" },
  { id: "high", label: "สูง", color: "var(--prio-high)" },
  { id: "normal", label: "ปกติ", color: "var(--status-progress)" },
  { id: "low", label: "ต่ำ", color: "var(--text-dim)" },
  { id: "none", label: "ไม่ระบุ", color: "var(--text-faint)" },
]

export const CATEGORIES: { id: string; color: string }[] = [
  { id: "Frontend", color: "#4a9eff" },
  { id: "Backend", color: "#22c55e" },
  { id: "Database", color: "#f5a524" },
  { id: "Design", color: "#ec4899" },
  { id: "DevOps", color: "#14b8a6" },
  { id: "Testing", color: "#a855f7" },
  { id: "Other", color: "#8b8b8b" },
]

export const COMPLEXITIES: { id: Complexity; label: string; color: string }[] = [
  { id: "low", label: "ง่าย", color: "var(--status-complete)" },
  { id: "medium", label: "ปานกลาง", color: "var(--prio-high)" },
  { id: "high", label: "ยาก", color: "var(--danger)" },
]

export const categoryColor = (name: string | null): string =>
  CATEGORIES.find((c) => c.id === name)?.color ?? "var(--text-faint)"

/**
 * สายที่ถนัด — GitHub ไม่มีข้อมูลนี้ ผู้ใช้ต้องเลือกเอง
 * ตั้งชื่อให้ตรงกับ CATEGORIES ที่ AI ใช้ จะได้จับคู่คนกับงานได้
 */
export const ROLES = [
  "Frontend",
  "Backend",
  "Fullstack",
  "Database",
  "Design",
  "DevOps",
  "Testing",
]

/** สีที่ให้เลือกตอนเพิ่มพนักงานใหม่ */
export const MEMBER_COLORS = [
  "#7b68ee",
  "#e5484d",
  "#f5a524",
  "#22c55e",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
]

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
