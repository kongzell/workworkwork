import { useEffect, useState } from "react"
import type { Commit, SystemHealth, WebhookEvent } from "../api"
import { getCommits, getSystemHealth, getWebhookEvents } from "../api"
import type { Project, Task } from "../types"
import { IconCheck, IconChevronRight, IconSparkle } from "./Icons"
import "./RightSidebar.css"

type Props = {
  project: Project
  onOpenTaskRef: (ref: string) => void
}

export function RightSidebar({ project, onOpenTaskRef }: Props) {
  return (
    <aside className="rs">
      <ProjectStats project={project} />
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
        <div><dt>การ์ดบนบอร์ด</dt><dd>{cards.length}</dd></div>
        <div><dt>รอเริ่ม</dt><dd className="c-todo">{todo}</dd></div>
        <div><dt>กำลังทำ</dt><dd className="c-prog">{doing}</dd></div>
        <div><dt>เสร็จแล้ว</dt><dd className="c-done">{done}</dd></div>
        <div><dt>เวลาที่ประเมิน</dt><dd>{hours ? `${hours.toFixed(1)} ชม.` : "—"}</dd></div>
      </dl>
    </section>
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

function GithubActivity({ onOpenTaskRef }: { onOpenTaskRef: (ref: string) => void }) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    const load = async () => {
      setLoading(true)
      const [c, e] = await Promise.allSettled([getCommits(6), getWebhookEvents(8)])
      if (!alive) return
      setCommits(c.status === "fulfilled" ? c.value : [])
      setEvents(e.status === "fulfilled" ? e.value : [])
      setNote(c.status === "rejected" ? String(c.reason?.message ?? "ดึง commit ไม่สำเร็จ") : null)
      setLoading(false)
    }

    void load()
    // ยังไม่มี websocket — ถามซ้ำทุก 30 วินาทีพอ
    const timer = setInterval(() => void load(), 30_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

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
        <span className="rs-count">{rows.length}</span>
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

      {loading && rows.length > 0 && <p className="rs-empty">กำลังอัปเดต...</p>}
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

/* ---------- AI Task Details (slide-out) ---------- */

export function TaskDetailPanel({
  task,
  subtasks,
  onClose,
  onToggleSubtaskDone,
}: {
  task: Task
  subtasks: Task[]
  onClose: () => void
  onToggleSubtaskDone: (id: string) => void
}) {
  const doneCount = subtasks.filter((s) => s.status === "complete").length

  return (
    <aside className="rs-detail" role="dialog" aria-label={`รายละเอียดของ ${task.title}`}>
      <header className="rs-detail-head">
        <button type="button" className="rs-detail-close" onClick={onClose} title="ปิด">
          <IconChevronRight size={16} />
        </button>
        <span className="rs-title">รายละเอียดงาน</span>
      </header>

      <div className="rs-detail-body">
        <h3 className="rs-detail-title">{task.title}</h3>

        <dl className="rs-fields">
          <div><dt>หมวดหมู่</dt><dd>{task.category ?? "—"}</dd></div>
          <div><dt>เวลาที่ประเมิน</dt><dd>{task.estimateHours ? `${task.estimateHours} ชม.` : "—"}</dd></div>
          <div><dt>ความยาก</dt><dd>{task.complexity ?? "—"}</dd></div>
        </dl>

        <div className="rs-block">
          <span className="rs-block-title">ทักษะที่ต้องใช้</span>
          {task.tags.length === 0 ? (
            <p className="rs-empty">ไม่มีข้อมูล</p>
          ) : (
            <div className="rs-tags">
              {task.tags.map((t) => (
                <span key={t} className="rs-tag">{t}</span>
              ))}
            </div>
          )}
        </div>

        <div className="rs-block">
          <span className="rs-block-title">
            <IconSparkle size={12} /> งานย่อย
            {subtasks.length > 0 && ` ${doneCount}/${subtasks.length}`}
          </span>
          {subtasks.length === 0 ? (
            <p className="rs-empty">งานนี้ไม่มีงานย่อย</p>
          ) : (
            <ul className="rs-subtasks">
              {subtasks.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`rs-sub-check${s.status === "complete" ? " is-done" : ""}`}
                    aria-pressed={s.status === "complete"}
                    onClick={() => onToggleSubtaskDone(s.id)}
                  >
                    {s.status === "complete" && <IconCheck size={11} />}
                  </button>
                  <span className={`rs-sub-title${s.status === "complete" ? " is-done" : ""}`}>
                    {s.title}
                  </span>
                  {s.category && <span className="rs-sub-cat">{s.category}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  )
}
