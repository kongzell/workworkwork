import { useMemo, useState } from "react"
import type { Filters } from "../App"
import type { Member, PriorityId, Project, StatusId, Task } from "../types"
import { CATEGORIES, categoryColor, STATUSES } from "../types"
import { TaskCard } from "./TaskCard"
import { IconPlus } from "./Icons"
import "./Board.css"

type Props = {
  project: Project
  members: Member[]
  /** คำค้นจากช่องค้นหาบนแถบหัว */
  query: string
  filters: Filters
  /** จัดคอลัมน์ตามสถานะ หรือตามหมวดหมู่ที่ AI ให้มา */
  groupBy: "status" | "category"
  selectedTaskId: string | null
  onOpenTask: (id: string) => void
  onAddTask: (status: StatusId, title: string) => void
  onChangeStatus: (taskId: string, status: StatusId) => void
  onToggleAssignee: (taskId: string, memberId: string) => void
  onSetPriority: (taskId: string, priority: PriorityId) => void
  onSetDue: (taskId: string, date: string | null) => void
  onSetCategory: (taskId: string, category: string | null) => void
  onDeleteTask: (taskId: string) => void
  onAddMember: () => void
  onClearFilters: () => void
}

export function Board({
  project, members, query, filters, groupBy, selectedTaskId, onOpenTask,
  onAddTask, onChangeStatus, onToggleAssignee,
  onSetPriority, onSetDue, onSetCategory, onDeleteTask, onAddMember, onClearFilters,
}: Props) {
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    // งานย่อยไม่ขึ้นบนบอร์ด — ดูได้จากแผงรายละเอียดฝั่งขวา
    return project.tasks.filter((t) => {
      if (t.parentId) return false
      if (q && !t.title.toLowerCase().includes(q)) return false
      if (filters.assigneeId && !t.assigneeIds.includes(filters.assigneeId)) return false
      if (filters.priority && t.priority !== filters.priority) return false
      return true
    })
  }, [project.tasks, query, filters])

  const boardTasks = project.tasks.filter((t) => !t.parentId)
  const narrowed = visible.length < boardTasks.length

  /** คอลัมน์ที่จะแสดง — ตามสถานะ หรือตามหมวดหมู่ที่มีงานอยู่จริง */
  const columns =
    groupBy === "status"
      ? STATUSES.map((s) => ({
          key: s.id,
          label: s.label,
          color: s.color,
          tasks: visible.filter((t) => t.status === s.id),
          addStatus: s.id as StatusId,
        }))
      : [
          ...CATEGORIES.filter((c) => visible.some((t) => t.category === c.id)).map((c) => ({
            key: c.id,
            label: c.id,
            color: c.color,
            tasks: visible.filter((t) => t.category === c.id),
            addStatus: "todo" as StatusId,
          })),
          {
            key: "__none",
            label: "ยังไม่จัดหมวด",
            color: categoryColor(null),
            tasks: visible.filter((t) => !t.category),
            addStatus: "todo" as StatusId,
          },
        ].filter((c) => c.tasks.length > 0 || c.key === "__none")

  return (
    <div className="board-wrap">
      {narrowed && (
        <div className="board-note">
          แสดง {visible.length} จาก {boardTasks.length} งาน
          <button type="button" className="board-note-clear" onClick={onClearFilters}>
            ล้างตัวกรอง
          </button>
        </div>
      )}

      <div className={`board${groupBy === "category" ? " by-category" : ""}`}>
        {columns.map((col) => {
          const tasks = col.tasks
          return (
            <section key={col.key} className="column">
              <header className="col-head" style={{ borderBottomColor: col.color }}>
                <span className="col-name">{col.label}</span>
                <span className="col-count">{tasks.length}</span>
              </header>

              {tasks.map((t: Task) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  members={members}
                  subtasks={project.tasks.filter((s) => s.parentId === t.id)}
                  selected={t.id === selectedTaskId}
                  onOpen={() => onOpenTask(t.id)}
                  onChangeStatus={(status) => onChangeStatus(t.id, status)}
                  onToggleAssignee={(memberId) => onToggleAssignee(t.id, memberId)}
                  onSetPriority={(p) => onSetPriority(t.id, p)}
                  onSetDue={(d) => onSetDue(t.id, d)}
                  onSetCategory={(c) => onSetCategory(t.id, c)}
                  onDelete={() => onDeleteTask(t.id)}
                  onAddMember={onAddMember}
                />
              ))}

              <NewTask onSubmit={(title) => onAddTask(col.addStatus, title)} />
            </section>
          )
        })}
      </div>
    </div>
  )
}

function NewTask({ onSubmit }: { onSubmit: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")

  const commit = () => {
    const t = title.trim()
    if (t) onSubmit(t)
    setTitle("")
    setEditing(false)
  }

  if (!editing) {
    return (
      <button type="button" className="add-task" onClick={() => setEditing(true)}>
        <IconPlus size={14} /> เพิ่มงาน
      </button>
    )
  }

  return (
    <input
      autoFocus
      className="new-task-input"
      placeholder="ชื่องาน แล้วกด Enter"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit()
        if (e.key === "Escape") { setTitle(""); setEditing(false) }
      }}
    />
  )
}
