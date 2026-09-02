import type { Member, Project } from "./types"

/** ข้อมูลตั้งต้น — เก็บใน state ของ React เท่านั้น (ยังไม่มี backend) */
export const INITIAL_MEMBERS: Member[] = [
  { id: "m1", name: "Netithon Laohapan", role: "Fullstack", color: "#7b68ee" },
  { id: "m2", name: "Somchai Jaidee", role: "Backend", color: "#3b82f6" },
  { id: "m3", name: "Malee Kaewta", role: "Design", color: "#ec4899" },
]

/** ยังไม่มีโปรเจคตั้งต้น — สร้างเองในหน้าเว็บ หรือดึงมาจาก GitHub */
export const INITIAL_PROJECTS: Project[] = []
