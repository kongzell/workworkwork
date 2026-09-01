import { useEffect, useState } from "react"
import type { GithubRepo } from "../api"
import { getMyRepos, importRepoCollaborators } from "../api"
import { IconClose, IconGithub, IconPlus } from "./Icons"
import "./Modal.css"

type Props = {
  /** repo ที่ถูกเพิ่มเป็นโปรเจคไปแล้ว จะได้ไม่เพิ่มซ้ำ */
  usedRepos: string[]
  onClose: () => void
  onAdd: (name: string, githubRepo: string | null, memberIds: string[]) => void
  /** เรียกหลังดึง collaborator เพื่อให้ App โหลดรายชื่อพนักงานใหม่ */
  onMembersChanged: () => Promise<void>
}

export function AddProjectModal({ usedRepos, onClose, onAdd, onMembersChanged }: Props) {
  const [repos, setRepos] = useState<GithubRepo[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState("")
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const rows = await getMyRepos()
        if (alive) setRepos(rows)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "ดึงรายชื่อ repo ไม่สำเร็จ")
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  const addManual = () => {
    const name = manual.trim()
    if (!name) return
    onAdd(name, null, [])
    onClose()
  }

  /** เพิ่ม repo เป็นโปรเจค พร้อมดึง collaborator เข้าเป็นสมาชิกให้เลย */
  const addRepo = async (fullName: string) => {
    setAdding(fullName)
    setError(null)
    try {
      const result = await importRepoCollaborators(fullName)
      await onMembersChanged()
      onAdd(
        fullName.split("/").pop() ?? fullName,
        fullName,
        result.members.map((m) => m.id),
      )
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดึง collaborator ไม่สำเร็จ")
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="เพิ่มโปรเจค"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2 className="modal-title"><IconGithub size={16} /> เพิ่มโปรเจคจาก GitHub</h2>
            <p className="modal-sub">collaborator ของ repo จะถูกเพิ่มเป็นสมาชิกให้อัตโนมัติ</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} title="ปิด">
            <IconClose size={16} />
          </button>
        </header>

        <div className="modal-body">
          {loading && <p className="modal-hint">กำลังโหลด repo...</p>}

          {error && (
            <p className="modal-error">
              {error}
            </p>
          )}

          {repos !== null && repos.length === 0 && (
            <p className="modal-hint">ไม่เจอ repo ที่คุณมีสิทธิ์ push</p>
          )}

          {repos !== null && repos.length > 0 && (
            <ul className="member-list gh-list">
              {repos.map((r) => {
                const used = usedRepos.includes(r.fullName)
                return (
                  <li key={r.fullName} className="member-row">
                    <span className="member-info">
                      <span className="member-name">{r.fullName}</span>
                      <span className="member-role">{r.private ? "private" : "public"}</span>
                    </span>
                    <button
                      type="button"
                      className="member-action"
                      disabled={used || adding !== null}
                      onClick={() => void addRepo(r.fullName)}
                    >
                      {used ? "เพิ่มแล้ว" : adding === r.fullName ? "กำลังดึง..." : "เพิ่ม"}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <section className="modal-section">
            <h3 className="modal-h3">หรือสร้างโปรเจคเปล่า</h3>
            <div className="empty-form">
              <input
                className="field-input"
                placeholder="ชื่อโปรเจค"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addManual()}
              />
              <button type="button" className="btn" onClick={addManual}>
                <IconPlus size={14} /> สร้าง
              </button>
            </div>
          </section>
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>ปิด</button>
        </footer>
      </div>
    </div>
  )
}
