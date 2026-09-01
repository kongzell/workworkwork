import type { Member, PriorityId, StatusId, Task } from "../types"
import { CATEGORIES, categoryColor, COMPLEXITIES, PRIORITIES, STATUSES } from "../types"
import { Avatar } from "./Avatar"
import { Menu, MenuItem, MenuLabel } from "./Menu"
import { IconCalendar, IconCheck, IconDots, IconFlag, IconPlus, IconTrash, IconUser } from "./Icons"

type Props = {
  task: Task
  /** พนักงานทั้งหมดในโปรเจคนี้ */
  members: Member[]
  /** งานย่อยของการ์ดใบนี้ (ถ้ามี) */
  subtasks: Task[]
  selected: boolean
  onOpen: () => void
  onChangeStatus: (status: StatusId) => void
  onToggleAssignee: (memberId: string) => void
  onSetPriority: (priority: PriorityId) => void
  onSetDue: (date: string | null) => void
  onSetCategory: (category: string | null) => void
  onDelete: () => void
  onAddMember: () => void
}

const fmtDue = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" })

export function TaskCard({
  task, members, subtasks, selected, onOpen, onChangeStatus, onToggleAssignee,
  onSetPriority, onSetDue, onSetCategory, onDelete, onAddMember,
}: Props) {
  const assignees = members.filter((m) => task.assigneeIds.includes(m.id))
  const priority = PRIORITIES.find((p) => p.id === task.priority)!
  const hasPriority = task.priority !== "none"
  const isBare = assignees.length === 0 && !task.dueDate && !hasPriority
  const complexity = COMPLEXITIES.find((c) => c.id === task.complexity)
  const subDone = subtasks.filter((s) => s.status === "complete").length

  /** คนที่ถนัดตรงกับหมวดหมู่ของงานนี้ (Fullstack ถือว่าตรงกับ Frontend/Backend) */
  const matches = (m: Member) =>
    task.category !== null &&
    (m.role === task.category ||
      (m.role === "Fullstack" && (task.category === "Frontend" || task.category === "Backend")))

  // เอาคนที่ถนัดตรงงานขึ้นก่อน จะได้เลือกง่าย
  const sortedMembers = [...members].sort((a, b) => Number(matches(b)) - Number(matches(a)))

  return (
    <article
      className={`card p-${task.priority}${task.status === "complete" ? " is-done" : ""}${selected ? " is-selected" : ""}`}
    >
      <div className="card-head">
        <button type="button" className="card-open" onClick={onOpen}>
          <h3 className="card-title">{task.title}</h3>
        </button>
        <div className="card-more">
          <Menu align="right" title="ตัวเลือก" trigger={() => <IconDots size={15} />}>
            {(close) => (
              <>
                <MenuLabel>ย้ายไปสถานะ</MenuLabel>
                {STATUSES.map((s) => (
                  <MenuItem
                    key={s.id}
                    active={s.id === task.status}
                    onClick={() => { onChangeStatus(s.id); close() }}
                  >
                    <span className="dot" style={{ background: s.color }} />
                    <span className="menu-grow">{s.label}</span>
                    {s.id === task.status && <IconCheck size={14} />}
                  </MenuItem>
                ))}
                <MenuLabel>หมวดหมู่</MenuLabel>
                {CATEGORIES.map((c) => (
                  <MenuItem
                    key={c.id}
                    active={c.id === task.category}
                    onClick={() => { onSetCategory(c.id === task.category ? null : c.id); close() }}
                  >
                    <span className="dot" style={{ background: c.color }} />
                    <span className="menu-grow">{c.id}</span>
                    {c.id === task.category && <IconCheck size={14} />}
                  </MenuItem>
                ))}

                <MenuItem danger onClick={() => { onDelete(); close() }}>
                  <IconTrash size={14} /> ลบงานนี้
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>

      {subtasks.length > 0 && (
        <button type="button" className="card-sub" onClick={onOpen}>
          งานย่อย {subDone}/{subtasks.length}
          <span className="card-sub-bar">
            <span style={{ width: `${(subDone / subtasks.length) * 100}%` }} />
          </span>
        </button>
      )}

      {(task.category || task.tags.length > 0 || task.estimateHours !== null || complexity) && (
        <div className="card-ai">
          {task.category && (
            <span className="card-cat" style={{ color: categoryColor(task.category) }}>
              {task.category}
            </span>
          )}
          {task.tags.map((t) => (
            <span key={t} className="card-tag">{t}</span>
          ))}
          {task.estimateHours !== null && <span className="card-est">{task.estimateHours} ชม.</span>}
          {complexity && (
            <span className="card-cx" style={{ color: complexity.color }}>{complexity.label}</span>
          )}
        </div>
      )}

      <div className="card-foot">
        <div className="card-meta">
          {assignees.map((m) => <Avatar key={m.id} member={m} size={20} />)}
          {task.dueDate && <span className="card-date">{fmtDue(task.dueDate)}</span>}
          {hasPriority && (
            <span className="card-prio" style={{ color: priority.color }}>{priority.label}</span>
          )}
          {isBare && <span className="card-empty">ยังไม่กำหนด</span>}
        </div>

        <div className="card-tools">
          <Menu title="ผู้รับผิดชอบ" trigger={() => <IconUser size={15} />}>
            {() => (
              <>
                <MenuLabel>ผู้รับผิดชอบ</MenuLabel>
                {members.length === 0 && <div className="menu-empty">ยังไม่มีพนักงานในโปรเจค</div>}
                {sortedMembers.map((m) => (
                  <MenuItem key={m.id} active={task.assigneeIds.includes(m.id)} onClick={() => onToggleAssignee(m.id)}>
                    <Avatar member={m} size={18} />
                    <span className="menu-grow">{m.name}</span>
                    <span className={`menu-role${matches(m) ? " is-match" : ""}`}>{m.role}</span>
                    {task.assigneeIds.includes(m.id) && <IconCheck size={14} />}
                  </MenuItem>
                ))}
                <MenuItem onClick={onAddMember}>
                  <IconPlus size={14} /> เพิ่มพนักงาน
                </MenuItem>
              </>
            )}
          </Menu>

          <Menu title="กำหนดส่ง" trigger={() => <IconCalendar size={15} />}>
            {(close) => (
              <>
                <MenuLabel>กำหนดส่ง</MenuLabel>
                <input
                  type="date"
                  className="menu-date"
                  value={task.dueDate ?? ""}
                  onChange={(e) => onSetDue(e.target.value || null)}
                />
                <MenuItem onClick={() => { onSetDue(null); close() }}>ล้างวันที่</MenuItem>
              </>
            )}
          </Menu>

          <Menu title="ความสำคัญ" trigger={() => <IconFlag size={15} />}>
            {(close) => (
              <>
                <MenuLabel>ความสำคัญ</MenuLabel>
                {PRIORITIES.map((p) => (
                  <MenuItem key={p.id} active={p.id === task.priority} onClick={() => { onSetPriority(p.id); close() }}>
                    <span className="dot" style={{ background: p.color }} />
                    <span className="menu-grow">{p.label}</span>
                    {p.id === task.priority && <IconCheck size={14} />}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
        </div>
      </div>
    </article>
  )
}
