import { useEffect, useState } from "react"
import type { Commit, SystemHealth, WebhookEvent } from "../api"
import { getCommits, getSystemHealth, getWebhookEvents } from "../api"
import type { Member, Project, Task } from "../types"
import { openTasksOf, STATUSES, taskPoints } from "../types"
import { Avatar } from "./Avatar"
import { IconChevronRight, IconPlus } from "./Icons"
import "./RightSidebar.css"

type Props = {
  project: Project | null
  members: Member[]
  onOpenTaskRef: (ref: string) => void
  onAddMember: () => void
  onOpenMember: (id: string) => void
  /** เจ้าของโปรเจคเท่านั้นที่เพิ่มพนักงานได้ */
  isOwner: boolean
}

export function RightSidebar({
  project,
  members,
  onOpenTaskRef,
  onAddMember,
  onOpenMember,
  isOwner,
}: Props) {
  return (
    <aside className="rs">
      {project && <ProjectStats project={project} />}
      {project && (
        <TeamPanel
          members={members}
          tasks={project.tasks}
          onAddMember={onAddMember}
          onOpenMember={onOpenMember}
          isOwner={isOwner}
        />
      )}
      <GithubActivity onOpenTaskRef={onOpenTaskRef} />
      <HealthBar />
    </aside>
  )
}

/* ---------- Project Context & Stats ---------- */

function ProjectStats({ project }: { project: Project }) {
  const cards = project.tasks.filter((t) => !t.parentId)
  const done = project.tasks.filter((t) => t.status === "complete").length
  const doing = project.tasks.filter((t) => t.status === "in-progress").length
  const review = project.tasks.filter((t) => t.status === "review").length
  const todo = project.tasks.filter((t) => t.status === "todo").length
  const total = project.tasks.length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  const hours = project.tasks.reduce((sum, t) => sum + (t.estimateHours ?? 0), 0)

  return (
    <section className="rs-panel">
      <header className="rs-head">
        <span className="rs-title">{project.name}</span>
        <span className="rs-badge">{percent}%</span>
      </header>

      <div className="rs-progress" role="img" aria-label={`คืบหน้า ${percent} เปอร์เซ็นต์`}>
        <span style={{ width: `${percent}%` }} />
      </div>

      <dl className="rs-stats">
        <div><dt>งานทั้งหมด</dt><dd>{total}</dd></div>
        <div><dt>งานหลัก</dt><dd>{cards.length}</dd></div>
        <div><dt>รอเริ่ม</dt><dd className="c-todo">{todo}</dd></div>
        <div><dt>กำลังทำ</dt><dd className="c-prog">{doing}</dd></div>
        <div><dt>รอตรวจ</dt><dd className="c-review">{review}</dd></div>
        <div><dt>เสร็จแล้ว</dt><dd className="c-done">{done}</dd></div>
        <div><dt>เวลาที่ประเมิน</dt><dd>{hours ? `${hours.toFixed(1)} ชม.` : "—"}</dd></div>
      </dl>
    </section>
  )
}

/* ---------- ทีมในโปรเจค ---------- */

function TeamPanel({
  members,
  tasks,
  onAddMember,
  onOpenMember,
  isOwner,
}: {
  members: Member[]
  tasks: Task[]
  onAddMember: () => void
  onOpenMember: (id: string) => void
  isOwner: boolean
}) {
  const load = members.map((m) => {
    const open = openTasksOf(tasks, m.id)
    return {
      member: m,
      count: open.length,
      points: open.reduce((sum, t) => sum + taskPoints(t), 0),
    }
  })

  const total = load.reduce((sum, l) => sum + l.points, 0)
  const heaviest = Math.max(1, ...load.map((l) => l.points))
  //: ถ้าแบ่งงานเท่ากันทุกคนควรได้คนละเท่านี้
  const fairShare = members.length > 0 ? total / members.length : 0

  return (
    <section className="rs-panel">
      <header className="rs-head">
        <span className="rs-title">ทีมในโปรเจค</span>
        <span className="rs-count">{members.length}</span>
      </header>

      {members.length === 0 && <p className="rs-empty">ยังไม่มีใครในโปรเจคนี้</p>}

      {total > 0 && (
        <p className="rs-fair">แบ่งเท่ากันควรได้คนละ {fairShare.toFixed(1)} แต้ม</p>
      )}

      <ul className="rs-team">
        {load.map(({ member, count, points }) => {
          // เกินส่วนแบ่งที่ควรได้มาก = งานหนักเกินคนอื่น
          const over = fairShare > 0 && points > fairShare * 1.4
          const under = fairShare > 0 && points < fairShare * 0.6
          return (
            <li key={member.id}>
              <button type="button" className="rs-team-row" onClick={() => onOpenMember(member.id)}>
                <div className="rs-team-top">
                  <Avatar member={member} size={22} />
                  <span className="rs-team-name">{member.name}</span>
                  <span className="rs-team-role">{member.role}</span>
                </div>
                <div className="rs-load">
                  <span className="rs-load-bar">
                    <span
                      className={`rs-load-fill${over ? " is-over" : ""}${under ? " is-under" : ""}`}
                      style={{ width: `${(points / heaviest) * 100}%` }}
                    />
                  </span>
                  <span className="rs-load-num">
                    {points} แต้ม · {count} งาน
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {isOwner && (
        <button type="button" className="rs-add-member" onClick={onAddMember}>
          <IconPlus size={14} /> เพิ่มพนักงาน
        </button>
      )}
    </section>
  )
}

/* ---------- งานของคนคนหนึ่ง (slide-out) ---------- */

export function MemberDetailPanel({
  member,
  tasks,
  onClose,
  onOpenTask,
}: {
  member: Member
  tasks: Task[]
  onClose: () => void
  onOpenTask: (id: string) => void
}) {
  const mine = tasks.filter((t) => t.assigneeIds.includes(member.id))
  const open = mine.filter((t) => t.status !== "complete")
  const points = open.reduce((sum, t) => sum + taskPoints(t), 0)
  const hours = open.reduce((sum, t) => sum + (t.estimateHours ?? 0), 0)

  return (
    <aside className="rs-detail" role="dialog" aria-label={`งานของ ${member.name}`}>
      <header className="rs-detail-head">
        <button type="button" className="rs-detail-close" onClick={onClose} title="ปิด">
          <IconChevronRight size={16} />
        </button>
        <span className="rs-title">งานที่รับผิดชอบ</span>
      </header>

      <div className="rs-detail-body">
        <div className="rs-member-head">
          <Avatar member={member} size={34} />
          <div>
            <div className="rs-detail-title">{member.name}</div>
            <div className="rs-member-role">{member.role}</div>
          </div>
        </div>

        <dl className="rs-fields">
          <div><dt>ภาระงานที่ค้าง</dt><dd>{points} แต้ม</dd></div>
          <div><dt>จำนวนงานที่ค้าง</dt><dd>{open.length} งาน</dd></div>
          <div><dt>เวลาที่ประเมิน</dt><dd>{hours ? `${hours.toFixed(1)} ชม.` : "—"}</dd></div>
        </dl>

        {mine.length === 0 && <p className="rs-empty">ยังไม่ได้รับงานในโปรเจคนี้</p>}

        {STATUSES.map((s) => {
          const rows = mine.filter((t) => t.status === s.id)
          if (rows.length === 0) return null
          return (
            <div className="rs-block" key={s.id}>
              <span className="rs-block-title">
                <span className="dot" style={{ background: s.color }} /> {s.label} · {rows.length}
              </span>
              <ul className="rs-mine">
                {rows.map((t) => (
                  <li key={t.id}>
                    <button type="button" className="rs-mine-row" onClick={() => onOpenTask(t.id)}>
                      <span className="rs-mine-title">{t.title}</span>
                      <span className="rs-mine-pts">{taskPoints(t)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

/* ---------- GitHub Activity & Webhook Log ---------- */

type FeedRow = {
  key: string
  kind: "webhook" | "commit"
  text: string
  who: string | null
  ref: string | null
}

/** โควตา GitHub แบบไม่ล็อกอินคือ 60 ครั้ง/ชม. ถามทุก 5 นาที = 12 ครั้ง/ชม. */
const POLL_MS = 5 * 60 * 1000

function GithubActivity({ onOpenTaskRef }: { onOpenTaskRef: (ref: string) => void }) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    let timer: number | undefined

    const load = async () => {
      setLoading(true)
      const [c, e] = await Promise.allSettled([getCommits(6), getWebhookEvents(8)])
      if (!alive) return

      setCommits(c.status === "fulfilled" ? c.value : [])
      setEvents(e.status === "fulfilled" ? e.value : [])

      if (c.status === "rejected") {
        const raw = String(c.reason?.message ?? "")
        setNote(
          raw.includes("rate limit")
            ? "GitHub จำกัดจำนวนครั้งที่เรียกได้ต่อชั่วโมง — เข้าสู่ระบบด้วย GitHub จะได้โควตาสูงขึ้นมาก"
            : raw || "ดึง commit ไม่สำเร็จ",
        )
        // โดนจำกัดแล้วอย่ายิงซ้ำอัตโนมัติ รอผู้ใช้กดรีเฟรชเอง
        if (raw.includes("rate limit") && timer) clearInterval(timer)
      } else {
        setNote(null)
      }
      setLoading(false)
    }

    void load()
    timer = setInterval(() => void load(), POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [tick])

  const rows: FeedRow[] = [
    ...events.map((e) => ({
      key: e.id,
      kind: "webhook" as const,
      text: e.summary,
      who: e.actor,
      ref: e.taskRef,
    })),
    ...commits.map((c) => ({
      key: c.sha,
      kind: "commit" as const,
      text: c.message,
      who: c.author,
      ref: c.taskRef,
    })),
  ]

  return (
    <section className="rs-panel">
      <header className="rs-head">
        <span className="rs-title">GitHub Activity</span>
        <button
          type="button"
          className="rs-refresh"
          title="ดึงใหม่"
          disabled={loading}
          onClick={() => setTick((t) => t + 1)}
        >
          {loading ? "..." : "รีเฟรช"}
        </button>
      </header>

      {rows.length === 0 && <p className="rs-empty">{note ?? "ยังไม่มีความเคลื่อนไหว"}</p>}

      <ul className="rs-feed">
        {rows.slice(0, 10).map((r) => (
          <li key={`${r.kind}-${r.key}`} className="rs-feed-row">
            <span className={`rs-dot ${r.kind}`} title={r.kind === "webhook" ? "webhook" : "commit"} />
            <div className="rs-feed-body">
              <span className="rs-feed-text">{r.text}</span>
              <span className="rs-feed-meta">
                {r.who ?? "unknown"}
                {r.ref && (
                  <button type="button" className="rs-ref" onClick={() => onOpenTaskRef(r.ref as string)}>
                    {r.ref}
                  </button>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>

    </section>
  )
}

/* ---------- System & Database Health ---------- */

function HealthBar() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [reachable, setReachable] = useState(true)

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        const data = await getSystemHealth()
        if (!alive) return
        setHealth(data)
        setReachable(true)
      } catch {
        if (alive) setReachable(false)
      }
    }

    void load()
    const timer = setInterval(() => void load(), 20_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const items =
    !reachable || !health
      ? [{ label: "API", ok: false, note: "ต่อไม่ได้" }]
      : [
          { label: "API", ok: health.apiOk, note: undefined as string | undefined },
          { label: "Database", ok: health.databaseOk, note: health.databaseError ?? health.databaseKind },
          { label: "AI", ok: health.aiReady, note: health.aiModel },
          { label: "Login", ok: health.authReady, note: undefined },
          { label: "Webhook", ok: health.webhookReady, note: health.githubRepo ?? "ยังไม่เชื่อม repo" },
        ]

  return (
    <section className="rs-panel">
      <header className="rs-head">
        <span className="rs-title">System Health</span>
      </header>
      <ul className="rs-health">
        {items.map((i) => (
          <li key={i.label}>
            <span className={`rs-led${i.ok ? " is-ok" : ""}`} />
            <span className="rs-health-label">{i.label}</span>
            {i.note && <span className="rs-health-note">{i.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
