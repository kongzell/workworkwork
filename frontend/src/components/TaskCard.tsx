import type { Member, PriorityId, StatusId, Task } from "../types"
import {
  CATEGORIES, categoryColor, codeLink, COMPLEXITIES, PRIORITIES, STATUSES, taskKey,
  taskPoints,
} from "../types"
import { Avatar } from "./Avatar"
import { Menu, MenuItem, MenuLabel } from "./Menu"
import {
  IconCalendar, IconCheck, IconDots, IconFlag, IconGithub, IconHand, IconPlus, IconTrash,
  IconUser,
} from "./Icons"

type Props = {
  task: Task
  /** พนักงานทั้งหมดในโปรเจคนี้ */
  members: Member[]
  /** งานย่อยของการ์ดใบนี้ (ถ้ามี) */
  subtasks: Task[]
  /** รหัสย่อของโปรเจค ใช้ประกอบเป็นรหัสงาน */
  taskPrefix: string
  /** repo ของโปรเจค ใช้ประกอบลิงก์ compare ตอนมีแค่ชื่อ branch */
  githubRepo: string | null
  /** เจ้าของโปรเจค — วางแผนงานได้ (ความสำคัญ หมวดหมู่ กำหนดส่ง ลบ มอบหมายคนอื่น) */
  isOwner: boolean
  /** id ของคนที่ล็อกอินอยู่ ใช้ตัดสินว่ารับงานเองได้ไหม */
  currentMemberId: string | null
  /** กางรายละเอียดอยู่หรือไม่ */
  expanded: boolean
  /** ล็อกอินอยู่และยังไม่มีใครรับงานนี้ */
  canClaim: boolean
  onClaim: () => void
  onOpen: () => void
  onToggleSubtaskAssignee: (subtaskId: string, memberId: string) => void
  onSetSubtaskStatus: (subtaskId: string, status: StatusId) => void
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
  task, members, subtasks, taskPrefix, githubRepo, isOwner, currentMemberId, expanded,
  canClaim, onClaim, onOpen,
  onToggleSubtaskAssignee, onSetSubtaskStatus, onChangeStatus, onToggleAssignee,
  onSetPriority, onSetDue, onSetCategory, onDelete, onAddMember,
}: Props) {
  const assignees = members.filter((m) => task.assigneeIds.includes(m.id))
  const priority = PRIORITIES.find((p) => p.id === task.priority)!
  const hasPriority = task.priority !== "none"
  const isBare = assignees.length === 0 && !task.dueDate && !hasPriority && !canClaim
  const complexity = COMPLEXITIES.find((c) => c.id === task.complexity)
  const subDone = subtasks.filter((s) => s.status === "complete").length

  /** คนที่ถนัดตรงกับหมวดหมู่ของงานนี้ (Fullstack ถือว่าตรงกับ Frontend/Backend) */
  const matches = (m: Member) =>
    task.category !== null &&
    (m.role === task.category ||
      (m.role === "Fullstack" && (task.category === "Frontend" || task.category === "Backend")))

  // เอาคนที่ถนัดตรงงานขึ้นก่อน จะได้เลือกง่าย
  const sortedMembers = [...members].sort((a, b) => Number(matches(b)) - Number(matches(a)))

  const code = codeLink(task, githubRepo)

  //: สมาชิกส่งงานได้ถึงแค่ "รอตรวจ" — คนตรวจรับคือเจ้าของโปรเจค
  const movable = isOwner ? STATUSES : STATUSES.filter((s) => s.id !== "complete")

  return (
    <article
      className={`card p-${task.priority}${task.status === "complete" ? " is-done" : ""}${expanded ? " is-open" : ""}`}
    >
      <div className="card-head">
        <button
          type="button"
          className="card-open"
          aria-expanded={expanded}
          onClick={onOpen}
        >
          <span className="card-key" title="พิมพ์รหัสนี้ในข้อความ commit เพื่อผูกกับการ์ดใบนี้">
            {taskKey(taskPrefix, task.number)}
          </span>
          <h3 className="card-title">{task.title}</h3>
        </button>
        <div className="card-more">
          <Menu align="right" title="ตัวเลือก" trigger={() => <IconDots size={15} />}>
            {(close) => (
              <>
                <MenuLabel>ย้ายไปสถานะ</MenuLabel>
                {movable.map((s) => (
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
                {isOwner && <MenuLabel>หมวดหมู่</MenuLabel>}
                {isOwner && CATEGORIES.map((c) => (
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

                {isOwner && (
                  <MenuItem danger onClick={() => { onDelete(); close() }}>
                    <IconTrash size={14} /> ลบงานนี้
                  </MenuItem>
                )}
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

      {code && (
        <a
          className="card-code"
          href={code.url}
          target="_blank"
          rel="noreferrer"
          title="เปิดดูโค้ดบน GitHub"
        >
          <IconGithub size={12} />
          <span className="card-code-label">{code.label}</span>
        </a>
      )}

      <div className="card-foot">
        <div className="card-meta">
          {assignees.map((m) => <Avatar key={m.id} member={m} size={20} />)}
          {canClaim && (
            <button
              type="button"
              className="card-claim"
              title="รับงานนี้ไปทำ"
              onClick={onClaim}
            >
              <IconHand size={12} /> รับงาน
            </button>
          )}
          {task.dueDate && <span className="card-date">{fmtDue(task.dueDate)}</span>}
          {hasPriority && (
            <span className="card-prio" style={{ color: priority.color }}>{priority.label}</span>
          )}
          {isBare && <span className="card-empty">ยังไม่กำหนด</span>}
        </div>

        <div className="card-tools">
          <Menu title="ผู้รับผิดชอบ" trigger={() => <IconUser size={15} />}>
            {(close) => (
              <>
                <MenuLabel>ผู้รับผิดชอบ</MenuLabel>
                {members.length === 0 && <div className="menu-empty">ยังไม่มีพนักงานในโปรเจค</div>}

                {isOwner ? (
                  <>
                    {sortedMembers.map((m) => (
                      <MenuItem
                        key={m.id}
                        active={task.assigneeIds.includes(m.id)}
                        onClick={() => onToggleAssignee(m.id)}
                      >
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
                ) : (
                  <>
                    {/* สมาชิกดูได้ว่าใครทำอยู่ แต่กดสลับได้เฉพาะตัวเอง */}
                    {assignees.map((m) => (
                      <div key={m.id} className="menu-static">
                        <Avatar member={m} size={18} />
                        <span className="menu-grow">{m.name}</span>
                        <span className="menu-role">{m.role}</span>
                      </div>
                    ))}
                    {currentMemberId !== null && (
                      <MenuItem
                        active={task.assigneeIds.includes(currentMemberId)}
                        onClick={() => { onToggleAssignee(currentMemberId); close() }}
                      >
                        <IconHand size={14} />
                        <span className="menu-grow">
                          {task.assigneeIds.includes(currentMemberId) ? "ปล่อยงานนี้" : "รับงานนี้"}
                        </span>
                      </MenuItem>
                    )}
                  </>
                )}
              </>
            )}
          </Menu>

          {isOwner && (
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
          )}

          {isOwner && (
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
          )}
        </div>
      </div>

      {expanded && (
        <div className="card-detail">
          <dl className="cd-fields">
            <div>
              <dt>หมวดหมู่</dt>
              <dd style={task.category ? { color: categoryColor(task.category) } : undefined}>
                {task.category ?? "—"}
              </dd>
            </div>
            <div>
              <dt>เวลาที่ประเมิน</dt>
              <dd>{task.estimateHours ? `${task.estimateHours} ชม.` : "—"}</dd>
            </div>
            <div>
              <dt>ความยาก</dt>
              <dd style={complexity ? { color: complexity.color } : undefined}>
                {complexity ? `${complexity.label} · ${taskPoints(task)} แต้ม` : "—"}
              </dd>
            </div>
          </dl>

          {task.tags.length > 0 && (
            <div className="cd-block">
              <span className="cd-label">ทักษะที่ต้องใช้</span>
              <div className="cd-tags">
                {task.tags.map((t) => (
                  <span key={t} className="card-tag">{t}</span>
                ))}
              </div>
            </div>
          )}

          {subtasks.length > 0 && (
          <div className="cd-block">
            <span className="cd-label">
              งานย่อย {subDone}/{subtasks.length}
            </span>

            {(
              <ul className="cd-subs">
                {subtasks.map((s) => {
                  const owners = members.filter((m) => s.assigneeIds.includes(m.id))
                  const cx = COMPLEXITIES.find((c) => c.id === s.complexity)
                  return (
                    <li key={s.id} className={s.status === "complete" ? "is-done" : ""}>
                      <Menu
                        align="left"
                        title="สถานะของงานย่อย"
                        trigger={() => {
                          const st = STATUSES.find((x) => x.id === s.status)
                          return (
                            <span className="cd-status" style={{ color: st?.color }}>
                              <span className="dot" style={{ background: st?.color }} />
                              {st?.label}
                            </span>
                          )
                        }}
                      >
                        {(close) => (
                          <>
                            <MenuLabel>ย้ายไปสถานะ</MenuLabel>
                            {movable.map((st) => (
                              <MenuItem
                                key={st.id}
                                active={st.id === s.status}
                                onClick={() => {
                                  onSetSubtaskStatus(s.id, st.id)
                                  close()
                                }}
                              >
                                <span className="dot" style={{ background: st.color }} />
                                <span className="menu-grow">{st.label}</span>
                                {st.id === s.status && <IconCheck size={14} />}
                              </MenuItem>
                            ))}
                          </>
                        )}
                      </Menu>

                      <div className="cd-sub-body">
                        <span className="cd-sub-title">{s.title}</span>
                        <div className="cd-sub-meta">
                          {s.category && (
                            <span style={{ color: categoryColor(s.category) }}>{s.category}</span>
                          )}
                          {cx && <span style={{ color: cx.color }}>{cx.label}</span>}
                          {s.estimateHours !== null && (
                            <span className="cd-sub-hrs">{s.estimateHours} ชม.</span>
                          )}

                          <Menu
                            align="right"
                            title="ใครรับงานนี้"
                            trigger={() =>
                              owners.length > 0 ? (
                                <span className="cd-owners">
                                  {owners.map((m) => (
                                    <Avatar key={m.id} member={m} size={17} />
                                  ))}
                                </span>
                              ) : (
                                <span className="cd-unassigned">ยังไม่มีใครรับ</span>
                              )
                            }
                          >
                            {() => (
                              <>
                                <MenuLabel>ผู้รับผิดชอบ</MenuLabel>
                                {members.length === 0 && (
                                  <div className="menu-empty">ยังไม่มีพนักงานในโปรเจค</div>
                                )}
                                {members.map((m) => (
                                  <MenuItem
                                    key={m.id}
                                    active={s.assigneeIds.includes(m.id)}
                                    onClick={() => onToggleSubtaskAssignee(s.id, m.id)}
                                  >
                                    <Avatar member={m} size={18} />
                                    <span className="menu-grow">{m.name}</span>
                                    {s.assigneeIds.includes(m.id) && <IconCheck size={14} />}
                                  </MenuItem>
                                ))}
                              </>
                            )}
                          </Menu>
                        </div>
                      </div>

                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          )}
        </div>
      )}
    </article>
  )
}
