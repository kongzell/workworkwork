import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Member, PriorityId, Project, StatusId } from "./types"
import type { ThemeId } from "./themes"
import { loadTheme, saveTheme } from "./themes"
import type { AuthStatus, SubtaskSuggestion } from "./api"
import * as api from "./api"
import { createMemberApi, devLogin, getAuthStatus, getMembers, logout, updateMyRole } from "./api"
import { AddMemberModal } from "./components/AddMemberModal"
import { AddProjectModal } from "./components/AddProjectModal"
import { AiBreakdownModal } from "./components/AiBreakdownModal"
import { Board } from "./components/Board"
import { MemberDetailPanel, RightSidebar } from "./components/RightSidebar"
import { Sidebar } from "./components/Sidebar"
import { Topbar } from "./components/Topbar"
import { IconGithub, IconSparkle } from "./components/Icons"
import "./App.css"

export type Filters = { assigneeId: string | null; priority: PriorityId | null }

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [syncError, setSyncError] = useState<string | null>(null)
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<Filters>({ assigneeId: null, priority: null })
  const [collapsed, setCollapsed] = useState(false)
  const [groupBy, setGroupBy] = useState<"status" | "category">("status")
  const [aiOpen, setAiOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [starredIds, setStarredIds] = useState<string[]>([])
  const [theme, setTheme] = useState<ThemeId>(loadTheme)
  const [auth, setAuth] = useState<AuthStatus | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveTheme(theme)
  }, [theme])

  /** โหลดโปรเจคทั้งหมดจาก database */
  const refreshProjects = useCallback(async () => {
    try {
      const rows = await api.getProjects()
      setProjects(rows)
      setSyncError(null)
      return rows
    } catch (e) {
      // ยังไม่ล็อกอินไม่ใช่ความผิดพลาด — หน้า NeedLogin บอกอยู่แล้ว
      setProjects([])
      setSyncError(api.isUnauthorized(e) ? null : e instanceof Error ? e.message : "ต่อ API ไม่ได้")
      return null
    }
  }, [])

  /**
   * ยิง API แล้วโหลดข้อมูลใหม่ — ถ้าพลาดจะดึงของจริงจาก server กลับมา
   * เพื่อไม่ให้หน้าจอค้างอยู่ที่สถานะที่ไม่ได้บันทึกจริง
   */
  const sync = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action()
        setSyncError(null)
      } catch (e) {
        setSyncError(
          api.isUnauthorized(e) ? null : e instanceof Error ? e.message : "บันทึกไม่สำเร็จ",
        )
      }
      await refreshProjects()
    },
    [refreshProjects],
  )

  /** รายชื่อพนักงานมาจาก database — ถ้าต่อ API ไม่ได้ค่อยใช้ข้อมูลตัวอย่างในเครื่อง */
  const refreshMembers = useCallback(async () => {
    try {
      const rows = await getMembers()
      setAllMembers(rows.map(({ id, name, role, color }) => ({ id, name, role, color })))
    } catch {
      // ยังไม่ได้ล็อกอินหรือ backend ยังไม่ขึ้น — ไม่มีรายชื่อให้แสดง
      setAllMembers([])
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
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshProjects()
  }, [refreshAuth, refreshMembers, refreshProjects])

  // null เมื่อยังไม่มีโปรเจคสักใบ — หน้าจอจะแสดง empty state แทน
  const project = projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null
  /** เจ้าของโปรเจคที่เปิดอยู่ — เพิ่มงาน จัดการสมาชิก ลบโปรเจค ได้คนเดียว */
  const isOwner = project !== null && project.ownerId === auth?.member?.id

  const projectMembers = useMemo(
    () => (project ? allMembers.filter((m) => project.memberIds.includes(m.id)) : []),
    [allMembers, project],
  )

  const availableMembers = useMemo(
    () => (project ? allMembers.filter((m) => !project.memberIds.includes(m.id)) : allMembers),
    [allMembers, project],
  )

  const selectedMember = projectMembers.find((m) => m.id === selectedMemberId) ?? null

  const addTask = (status: StatusId, title: string) => {
    if (!project) return
    void sync(() => api.createTask(project.id, { title, status }))
  }

  /**
   * เพิ่มผลลัพธ์จาก AI — สร้างการ์ดแม่จากหัวข้อที่พิมพ์ไว้ 1 ใบ
   * แล้วเก็บงานย่อยไว้ข้างใน (ไม่ขึ้นบนบอร์ด ดูได้จากแผงรายละเอียดฝั่งขวา)
   */
  const addSuggestions = (parentTitle: string, picked: SubtaskSuggestion[]) => {
    if (!project) return
    const totalHours = picked.reduce((sum, s) => sum + s.estimateHours, 0)

    void sync(async () => {
      const parent = await api.createTask(project.id, {
        title: parentTitle,
        estimateHours: totalHours || null,
      })
      for (const s of picked) {
        await api.createTask(project.id, {
          title: s.title,
          parentId: parent.id,
          category: s.category,
          tags: s.tags,
          estimateHours: s.estimateHours,
          complexity: s.complexity,
        })
      }
      setSelectedTaskId(parent.id)
    })
  }

  /** ลบงานแม่ — งานย่อยถูกลบตามด้วย cascade ที่ฝั่ง database */
  const deleteTask = (taskId: string) => void sync(() => api.deleteTask(taskId))

  /**
   * มอบหมายงาน — ถ้าเป็นการเพิ่มคนให้งานที่ยัง "รอเริ่ม" จะย้ายไป "กำลังทำ" ให้เลย
   * งานที่อยู่รอตรวจ/เสร็จแล้วไม่ถูกย้าย เพราะการเพิ่มคนตรงนั้นคือการหาคนมาตรวจ ไม่ใช่เริ่มทำใหม่
   */
  const toggleAssignee = (taskId: string, memberId: string) => {
    const task = project?.tasks.find((t) => t.id === taskId)
    if (!task) return
    const adding = !task.assigneeIds.includes(memberId)
    void sync(async () => {
      await api.setAssignee(taskId, memberId, adding)
      if (adding && task.status === "todo") {
        await api.updateTask(taskId, { status: "in-progress" })
      }
    })
  }

  /** รับงานเอง — ถ้ายังไม่ได้อยู่ในโปรเจคจะถูกเพิ่มเข้าให้ด้วย */
  const claimTask = (taskId: string) => {
    const me = auth?.member
    const task = project?.tasks.find((t) => t.id === taskId)
    if (!me || !project || !task) return

    void sync(async () => {
      await api.setAssignee(taskId, me.id, true)
      if (task.status === "todo") {
        await api.updateTask(taskId, { status: "in-progress" })
      }
    })
  }

  const addExistingMember = (memberId: string) => {
    if (!project) return
    void sync(() => api.addProjectMember(project.id, memberId))
  }

  /** เอาออกจากโปรเจค — backend ถอด assign ในโปรเจคนี้ให้ด้วย */
  const removeMember = (memberId: string) => {
    if (!project) return
    void sync(() => api.removeProjectMember(project.id, memberId))
  }

  const createMember = async (name: string, role: string, color: string) => {
    const saved = await createMemberApi(name, role, color)
    await refreshMembers()
    if (project) await sync(() => api.addProjectMember(project.id, saved.id))
  }

  // ---------- โปรเจค ----------

  const addProject = (name: string, githubRepo: string | null = null, memberIds: string[] = []) => {
    void sync(async () => {
      const created = await api.createProject(name, githubRepo)
      for (const memberId of memberIds) {
        await api.addProjectMember(created.id, memberId)
      }
      setActiveProjectId(created.id)
    })
  }

  const renameProject = (name: string) => {
    if (!project) return
    void sync(() => api.updateProject(project.id, { name }))
  }

  const deleteProject = () => {
    if (!project) return
    const rest = projects.filter((p) => p.id !== project.id)
    setStarredIds((prev) => prev.filter((id) => id !== project.id))
    setActiveProjectId(rest[0]?.id ?? null)
    setSelectedTaskId(null)
    void sync(() => api.deleteProject(project.id))
  }

  const toggleStar = () => {
    if (!project) return
    setStarredIds((prev) =>
      prev.includes(project.id) ? prev.filter((id) => id !== project.id) : [...prev, project.id],
    )
  }

  return (
    <div className="app">
      {syncError && (
        <div className="sync-error" role="alert">
          บันทึกลงฐานข้อมูลไม่สำเร็จ: {syncError}
        </div>
      )}
      {!collapsed && (
        <Sidebar
          projects={projects}
          activeProjectId={project?.id ?? null}
          starredIds={starredIds}
          members={projectMembers}
          filters={filters}
          onChangeFilters={setFilters}
          onSelectProject={setActiveProjectId}
          onOpenAddProject={() => setProjectModalOpen(true)}
          onAddMember={() => setMemberModalOpen(true)}
          onFocusSearch={() => searchRef.current?.focus()}
          onCollapse={() => setCollapsed(true)}
          isOwner={isOwner}
        />
      )}

      <main className="main">
        <Topbar
          project={project}
          projects={projects}
          taskCount={project ? project.tasks.length : 0}
          query={query}
          searchRef={searchRef}
          starred={project ? starredIds.includes(project.id) : false}
          collapsed={collapsed}
          theme={theme}
          canDelete={isOwner}
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

        {auth !== null && auth.member === null ? (
          <NeedLogin configured={auth.configured} />
        ) : project === null ? (
          <EmptyProjects onOpen={() => setProjectModalOpen(true)} />
        ) : (
          <Board
            project={project}
            members={projectMembers}
            query={query}
            filters={filters}
            groupBy={groupBy}
            selectedTaskId={selectedTaskId}
            currentMemberId={auth?.member?.id ?? null}
            onClaimTask={claimTask}
            onOpenTask={(id) => setSelectedTaskId(id || null)}
            onSetSubtaskStatus={(id, status) => void sync(() => api.updateTask(id, { status }))}
            onAddTask={addTask}
            onChangeStatus={(taskId, status) => void sync(() => api.updateTask(taskId, { status }))}
            onToggleAssignee={toggleAssignee}
            onSetPriority={(taskId, priority: PriorityId) => void sync(() => api.updateTask(taskId, { priority }))}
            onSetDue={(taskId, dueDate) => void sync(() => api.updateTask(taskId, { dueDate }))}
            onSetCategory={(taskId, category) => void sync(() => api.updateTask(taskId, { category }))}
            onDeleteTask={(id) => {
              deleteTask(id)
              if (id === selectedTaskId) setSelectedTaskId(null)
            }}
            onAddMember={() => setMemberModalOpen(true)}
            onClearFilters={() => {
              setFilters({ assigneeId: null, priority: null })
              setQuery("")
            }}
            isOwner={isOwner}
          />
        )}
      </main>

      <div className="rs-wrap">
        <RightSidebar
          project={project}
          members={projectMembers}
          onOpenTaskRef={(ref) => setQuery(ref)}
          onAddMember={() => setMemberModalOpen(true)}
          onOpenMember={(id) => {
            setSelectedMemberId(id)
            setSelectedTaskId(null)
          }}
          isOwner={isOwner}
        />

        {selectedMember && project && (
          <MemberDetailPanel
            member={selectedMember}
            tasks={project.tasks}
            onClose={() => setSelectedMemberId(null)}
            onOpenTask={(id) => {
              setSelectedMemberId(null)
              setSelectedTaskId(id)
            }}
          />
        )}
      </div>

      {isOwner && (
        <button
          type="button"
          className="ai-fab"
          title="แตกงานด้วย AI"
          aria-label="แตกงานด้วย AI"
          onClick={() => setAiOpen(true)}
        >
          <IconSparkle size={22} />
        </button>
      )}

      {aiOpen && project && (
        <AiBreakdownModal
          projectName={project.name}
          onClose={() => setAiOpen(false)}
          onAdd={addSuggestions}
        />
      )}

      {projectModalOpen && (
        <AddProjectModal
          usedRepos={projects.map((p) => p.githubRepo).filter((r): r is string => r !== null)}
          onClose={() => setProjectModalOpen(false)}
          onAdd={addProject}
          onMembersChanged={refreshMembers}
        />
      )}

      {memberModalOpen && project && (
        <AddMemberModal
          projectName={project.name}
          githubRepo={project.githubRepo}
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

/** หน้าจอตอนยังไม่มีโปรเจคสักใบ */
function NeedLogin({ configured }: { configured: boolean }) {
  return (
    <div className="empty-projects">
      <h2>เข้าสู่ระบบก่อนใช้งาน</h2>
      <p>
        {configured
          ? "บอร์ดของแต่ละคนแยกกัน — เข้าสู่ระบบด้วย GitHub เพื่อดูโปรเจคที่คุณเป็นสมาชิก"
          : "ยังไม่ได้ตั้งค่า GitHub OAuth — ดูวิธีตั้งค่าใน README.docker.md"}
      </p>
      {configured && (
        <a className="btn btn-primary" href="/api/auth/github">
          <IconGithub size={14} /> เข้าสู่ระบบด้วย GitHub
        </a>
      )}
    </div>
  )
}

function EmptyProjects({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="empty-projects">
      <h2>ยังไม่มีโปรเจค</h2>
      <p>เพิ่ม repository จาก GitHub มาทำเป็นบอร์ด หรือสร้างโปรเจคเปล่าก็ได้</p>
      <button type="button" className="btn btn-primary" onClick={onOpen}>
        <IconGithub size={14} /> เพิ่มโปรเจค
      </button>
    </div>
  )
}
