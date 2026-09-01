import type { Member, Project } from "./types"

/** ข้อมูลตั้งต้น — เก็บใน state ของ React เท่านั้น (ยังไม่มี backend) */
export const INITIAL_MEMBERS: Member[] = [
  { id: "m1", name: "Netithon Laohapan", role: "Fullstack", color: "#7b68ee" },
  { id: "m2", name: "Somchai Jaidee", role: "Backend", color: "#3b82f6" },
  { id: "m3", name: "Malee Kaewta", role: "Design", color: "#ec4899" },
]

export const INITIAL_PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Project 1",
    memberIds: ["m1", "m2", "m3"],
    tasks: [
      { id: "t1", parentId: null, title: "ตรวจสิทธิ์ผู้ใช้แต่ละบทบาท", status: "todo", assigneeIds: ["m1"], dueDate: "2026-09-12", priority: "none", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t2", parentId: null, title: "ทำหน้า Report รายสัปดาห์", status: "todo", assigneeIds: [], dueDate: null, priority: "none", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t3", parentId: null, title: "เขียนเอกสารส่งมอบ", status: "todo", assigneeIds: [], dueDate: null, priority: "none", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t4", parentId: null, title: "ออกแบบหน้า Login", status: "in-progress", assigneeIds: ["m3"], dueDate: "2026-09-05", priority: "urgent", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t5", parentId: null, title: "เชื่อม API รายชื่อพนักงาน", status: "in-progress", assigneeIds: ["m2"], dueDate: "2026-09-08", priority: "normal", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t6", parentId: null, title: "ตั้งค่า Docker ให้ทีม", status: "complete", assigneeIds: ["m1"], dueDate: "2026-08-28", priority: "none", category: null, tags: [], estimateHours: null, complexity: null },
    ],
  },
  {
    id: "p2",
    name: "Project 2",
    memberIds: ["m1", "m3"],
    tasks: [
      { id: "t21", parentId: null, title: "ออกแบบโลโก้ใหม่", status: "in-progress", assigneeIds: ["m3"], dueDate: "2026-09-05", priority: "high", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t22", parentId: null, title: "เตรียมสไลด์นำเสนอ", status: "todo", assigneeIds: [], dueDate: null, priority: "normal", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t23", parentId: null, title: "สรุปงบประมาณ", status: "complete", assigneeIds: ["m1"], dueDate: null, priority: "low", category: null, tags: [], estimateHours: null, complexity: null },
    ],
  },
  {
    id: "p3",
    name: "Get Started with ClickUp",
    memberIds: ["m1"],
    tasks: [
      { id: "t37", parentId: null, title: "Use the Home view", status: "complete", assigneeIds: [], dueDate: null, priority: "none", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t38", parentId: null, title: "Create a task", status: "complete", assigneeIds: [], dueDate: null, priority: "none", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t39", parentId: null, title: "Try a Board view", status: "in-progress", assigneeIds: [], dueDate: null, priority: "none", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t310", parentId: null, title: "Invite your team", status: "todo", assigneeIds: [], dueDate: null, priority: "none", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t311", parentId: null, title: "Set up an Automation", status: "todo", assigneeIds: [], dueDate: null, priority: "none", category: null, tags: [], estimateHours: null, complexity: null },
      { id: "t312", parentId: null, title: "Connect an integration", status: "todo", assigneeIds: [], dueDate: null, priority: "none", category: null, tags: [], estimateHours: null, complexity: null },
    ],
  },
]

let seq = 100
export const nextId = (prefix: string) => `${prefix}${++seq}`
