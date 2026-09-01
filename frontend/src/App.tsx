import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { INITIAL_MEMBERS, INITIAL_PROJECTS, nextId } from "./data"
import type { Member, PriorityId, Project, StatusId, Task } from "./types"
import type { ThemeId } from "./themes"
import { loadTheme, saveTheme } from "./themes"
import type { AuthStatus, SubtaskSuggestion } from "./api"
import { createMemberApi, devLogin, getAuthStatus, getMembers, logout, updateMyRole } from "./api"
import { AddMemberModal } from "./components/AddMemberModal"
import { AiBreakdownModal } from "./components/AiBreakdownModal"
import { Board } from "./components/Board"
import { RightSidebar, TaskDetailPanel } from "./components/RightSidebar"
import { Sidebar } from "./components/Sidebar"
import { Topbar } from "./components/Topbar"
import { IconSparkle } from "./components/Icons"
import "./App.css"

export type Filters = { assigneeId: string | null; priority: PriorityId | null }

export default function App() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS)
  const [allMembers, setAllMembers] = useState<Member[]>(INITIAL_MEMBERS)
  const [activeProjectId, setActiveProjectId] = useState(INITIAL_PROJECTS[0].id)
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<Filters>({ assigneeId: null, priority: null })
  const [collapsed, setCollapsed] = useState(false)
  const [groupBy, setGroupBy] = useState<"status" | "category">("status")
  const [aiOpen, setAiOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [starredIds, setStarredIds] = useState<string[]>([])
  const [theme, setTheme] = useState<ThemeId>(loadTheme)
  const [auth, setAuth] = useState<AuthStatus | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveTheme(theme)
  }, [theme])

  /** รายชื่อพนักงานมาจาก database — ถ้าต่อ API ไม่ได้ค่อยใช้ข้อมูลตัวอย่างในเครื่อง */
  const refreshMembers = useCallback(async () => {
    try {
      const rows = await getMembers()
      if (rows.length > 0) setAllMembers(rows.map(({ id, name, role, color }) => ({ id, name, role, color })))
    } catch {
      // backend ยังไม่ขึ้น — ใช้ INITIAL_MEMBERS ต่อไป
    }
  }, [])

  const refreshAuth = useCallback(async () => {
    try {
      setAuth(await getAuthStatus())
    } catch {
      // backend ยังไม่ขึ้น — ถือว่ายังไม่ได้ล็อกอิน
      setAuth({ configured: false, devLogin: false, member: null })
    }
  }, [])

  useEffect(() => {
    // ถามสถานะล็อกอิน + รายชื่อพนักงานตอนเปิดหน้า — sync กับ backend ไม่ใช่ derived state
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshAuth()
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshMembers()
  }, [refreshAuth, refreshMembers])

  const project = projects.find((p) => p.id === activeProjectId) ?? projects[0]

  const projectMembers = useMemo(
    () => allMembers.filter((m) => project.memberIds.includes(m.id)),
    [allMembers, project.memberIds],
  )

  const availableMembers = useMemo(
    () => allMembers.filter((m) => !project.memberIds.includes(m.id)),
    [allMembers, project.memberIds],
  )

  const selectedTask = project.tasks.find((t) => t.id === selectedTaskId) ?? null
  const subtasks = selectedTask
    ? project.tasks.filter((t) => t.parentId === selectedTask.id)
    : []

  /** แก้เฉพาะโปรเจคที่เปิดอยู่ */
  const patchProject = (fn: (p: Project) => Project) =>
    setProjects((prev) => prev.map((p) => (p.id === project.id ? fn(p) : p)))

  const patchTask = (taskId: string, fn: (t: Task) => Task) =>
    patchProject((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === taskId ? fn(t) : t)) }))

  const addTask = (status: StatusId, title: string) =>
    patchProject((p) => ({
      ...p,
      tasks: [
        ...p.tasks,
        {
          id: nextId("t"), parentId: null, title, status, assigneeIds: [], dueDate: null,
          priority: "none", category: null, tags: [], estimateHours: null, complexity: null,
        },
      ],
    }))

  /**
   * เพิ่มผลลัพธ์จาก AI — สร้างการ์ดแม่จากหัวข้อที่พิมพ์ไว้ 1 ใบ
   * แล้วเก็บงานย่อยไว้ข้างใน (ไม่ขึ้นบนบอร์ด ดูได้จากแผงรายละเอียดฝั่งขวา)
   */
  const addSuggestions = (parentTitle: string, picked: SubtaskSuggestion[]) => {
    const parentId = nextId("t")
    const totalHours = picked.reduce((sum, s) => sum + s.estimateHours, 0)

    patchProject((p) => ({
      ...p,
      tasks: [
        ...p.tasks,
        {
          id: parentId,
          parentId: null,
          title: parentTitle,
          status: "todo" as StatusId,
          assigneeIds: [],
          dueDate: null,
          priority: "none" as PriorityId,
          category: null,
          tags: [],
          estimateHours: totalHours || null,
          complexity: null,
        },
        ...picked.map((s) => ({
          id: nextId("t"),
          parentId,
          title: s.title,
          status: "todo" as StatusId,
          assigneeIds: [],
          dueDate: null,
          priority: "none" as PriorityId,
          category: s.category,
          tags: s.tags,
          estimateHours: s.estimateHours,
          complexity: s.complexity,
        })),
      ],
    }))

    setSelectedTaskId(parentId)
  }

  /** ลบงานแม่ให้ลบงานย่อยตามไปด้วย */
  const deleteTask = (taskId: string) =>
    patchProject((p) => ({
      ...p,
      tasks: p.tasks.filter((t) => t.id !== taskId && t.parentId !== taskId),
    }))

  const toggleSubtaskDone = (id: string) =>
    patchTask(id, (t) => ({ ...t, status: t.status === "complete" ? "todo" : "complete" }))

  const toggleAssignee = (taskId: string, memberId: string) =>
    patchTask(taskId, (t) => ({
      ...t,
      assigneeIds: t.assigneeIds.includes(memberId)
        ? t.assigneeIds.filter((id) => id !== memberId)
        : [...t.assigneeIds, memberId],
    }))

  const addExistingMember = (memberId: string) =>
    patchProject((p) =>
      p.memberIds.includes(memberId) ? p : { ...p, memberIds: [...p.memberIds, memberId] },
    )

  /** เอาออกจากโปรเจค + ถอด assign ออกจากทุก task ของโปรเจคนี้ */
  const removeMember = (memberId: string) =>
    patchProject((p) => ({
      ...p,
      memberIds: p.memberIds.filter((id) => id !== memberId),
      tasks: p.tasks.map((t) => ({ ...t, assigneeIds: t.assigneeIds.filter((id) => id !== memberId) })),
    }))

  const createMember = async (name: string, role: string, color: string) => {
    try {
      const saved = await createMemberApi(name, role, color)
      setAllMembers((prev) => [...prev, { id: saved.id, name: saved.name, role: saved.role, color: saved.color }])
      addExistingMember(saved.id)
    } catch {
      // ต่อ API ไม่ได้ — เก็บไว้ในเครื่องก่อน
      const member: Member = { id: nextId("m"), name, role, color }
      setAllMembers((prev) => [...prev, member])
      addExistingMember(member.id)
    }
  }

  // ---------- โปรเจค ----------

  const addProject = (name: string) => {
    const created: Project = { id: nextId("p"), name, tasks: [], memberIds: [] }
    setProjects((prev) => [...prev, created])
    setActiveProjectId(created.id)
  }

  const renameProject = (name: string) => patchProject((p) => ({ ...p, name }))

  const deleteProject = () => {
    if (projects.length <= 1) return
    const rest = projects.filter((p) => p.id !== project.id)
    setProjects(rest)
    setStarredIds((prev) => prev.filter((id) => id !== project.id))
    setActiveProjectId(rest[0].id)
  }

  const toggleStar = () =>
    setStarredIds((prev) =>
      prev.includes(project.id) ? prev.filter((id) => id !== project.id) : [...prev, project.id],
    )

  return (
    <div className="app">
      {!collapsed && (
        <Sidebar
          projects={projects}
          activeProjectId={project.id}
          starredIds={starredIds}
          members={projectMembers}
          filters={filters}
          onChangeFilters={setFilters}
          onSelectProject={setActiveProjectId}
          onAddProject={addProject}
          onAddMember={() => setMemberModalOpen(true)}
          onFocusSearch={() => searchRef.current?.focus()}
          onCollapse={() => setCollapsed(true)}
        />
      )}

      <main className="main">
        <Topbar
          project={project}
          projects={projects}
          taskCount={project.tasks.filter((t) => !t.parentId).length}
          members={projectMembers}
          query={query}
          searchRef={searchRef}
          starred={starredIds.includes(project.id)}
          collapsed={collapsed}
          theme={theme}
          canDelete={projects.length > 1}
          groupBy={groupBy}
          auth={auth}
          onChangeGroupBy={setGroupBy}
          onQueryChange={setQuery}
          onSelectProject={setActiveProjectId}
          onRenameProject={renameProject}
          onDeleteProject={deleteProject}
          onToggleStar={toggleStar}
          onExpand={() => setCollapsed(false)}
          onChangeTheme={setTheme}
          onAddMember={() => setMemberModalOpen(true)}
          onDevLogin={async () => {
            await devLogin()
            await refreshAuth()
          }}
          onLogout={async () => {
            await logout()
            await refreshAuth()
          }}
          onChangeRole={async (role) => {
            await updateMyRole(role)
            await refreshAuth()
          }}
        />

        <Board
          project={project}
          members={projectMembers}
          query={query}
          filters={filters}
          groupBy={groupBy}
          selectedTaskId={selectedTaskId}
          onOpenTask={setSelectedTaskId}
          onAddTask={addTask}
          onChangeStatus={(taskId, status) => patchTask(taskId, (t) => ({ ...t, status }))}
          onToggleAssignee={toggleAssignee}
          onSetPriority={(taskId, priority: PriorityId) => patchTask(taskId, (t) => ({ ...t, priority }))}
          onSetDue={(taskId, dueDate) => patchTask(taskId, (t) => ({ ...t, dueDate }))}
          onSetCategory={(taskId, category) => patchTask(taskId, (t) => ({ ...t, category }))}
          onDeleteTask={(id) => {
            deleteTask(id)
            if (id === selectedTaskId) setSelectedTaskId(null)
          }}
          onAddMember={() => setMemberModalOpen(true)}
          onClearFilters={() => {
            setFilters({ assigneeId: null, priority: null })
            setQuery("")
          }}
        />
      </main>

      <div className="rs-wrap">
        <RightSidebar project={project} onOpenTaskRef={(ref) => setQuery(ref)} />
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            subtasks={subtasks}
            onClose={() => setSelectedTaskId(null)}
            onToggleSubtaskDone={toggleSubtaskDone}
          />
        )}
      </div>

      <button
        type="button"
        className="ai-fab"
        title="แตกงานด้วย AI"
        aria-label="แตกงานด้วย AI"
        onClick={() => setAiOpen(true)}
      >
        <IconSparkle size={22} />
      </button>

      {aiOpen && (
        <AiBreakdownModal
          projectName={project.name}
          onClose={() => setAiOpen(false)}
          onAdd={addSuggestions}
        />
      )}

      {memberModalOpen && (
        <AddMemberModal
          projectName={project.name}
          members={projectMembers}
          available={availableMembers}
          onClose={() => setMemberModalOpen(false)}
          onAddExisting={addExistingMember}
          onRemove={removeMember}
          onCreate={createMember}
          onImported={refreshMembers}
        />
      )}
    </div>
  )
}
