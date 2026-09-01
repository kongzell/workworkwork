import { useEffect, useState } from "react"
import type { GithubOrg, GithubRepo } from "../api"
import { getMyOrgs, getMyRepos, importOrgMembers, importRepoCollaborators } from "../api"
import type { Member } from "../types"
import { MEMBER_COLORS, ROLES } from "../types"
import { Avatar } from "./Avatar"
import { IconCheck, IconClose, IconPlus, IconTrash } from "./Icons"
import "./Modal.css"

type Props = {
  projectName: string
  /** พนักงานที่อยู่ในโปรเจคนี้แล้ว */
  members: Member[]
  /** พนักงานใน workspace ที่ยังไม่ได้อยู่ในโปรเจคนี้ */
  available: Member[]
  onClose: () => void
  onAddExisting: (memberId: string) => void
  onRemove: (memberId: string) => void
  onCreate: (name: string, role: string, color: string) => void
  /** เรียกหลังดึงรายชื่อจาก GitHub เสร็จ เพื่อให้ App โหลดพนักงานใหม่ */
  onImported: () => void
}

export function AddMemberModal({
  projectName, members, available, onClose, onAddExisting, onRemove, onCreate, onImported,
}: Props) {
  const [name, setName] = useState("")
  const [role, setRole] = useState(ROLES[0])
  const [color, setColor] = useState(MEMBER_COLORS[0])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const submit = () => {
    const n = name.trim()
    if (!n) {
      setError("กรุณากรอกชื่อพนักงาน")
      return
    }
    onCreate(n, role, color)
    setName("")
    setError(null)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`เพิ่มพนักงานใน ${projectName}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2 className="modal-title">เพิ่มพนักงานเข้าโปรเจค</h2>
            <p className="modal-sub">{projectName}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} title="ปิด">
            <IconClose size={16} />
          </button>
        </header>

        <div className="modal-body">
          <section className="modal-section">
            <h3 className="modal-h3">อยู่ในโปรเจคแล้ว ({members.length})</h3>
            {members.length === 0 && <p className="modal-empty">ยังไม่มีใครในโปรเจคนี้</p>}
            <ul className="member-list">
              {members.map((m) => (
                <li key={m.id} className="member-row">
                  <Avatar member={m} size={30} />
                  <span className="member-info">
                    <span className="member-name">{m.name}</span>
                    <span className="member-role">{m.role}</span>
                  </span>
                  <button
                    type="button"
                    className="member-action is-danger"
                    title="เอาออกจากโปรเจค"
                    onClick={() => onRemove(m.id)}
                  >
                    <IconTrash size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {available.length > 0 && (
            <section className="modal-section">
              <h3 className="modal-h3">พนักงานใน workspace</h3>
              <ul className="member-list">
                {available.map((m) => (
                  <li key={m.id} className="member-row">
                    <Avatar member={m} size={30} />
                    <span className="member-info">
                      <span className="member-name">{m.name}</span>
                      <span className="member-role">{m.role}</span>
                    </span>
                    <button type="button" className="member-action" onClick={() => onAddExisting(m.id)}>
                      <IconPlus size={14} /> เพิ่ม
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <GithubImport onImported={onImported} />

          <section className="modal-section">
            <h3 className="modal-h3">เพิ่มพนักงานใหม่</h3>
            <div className="field-grid">
              <label className="field">
                <span className="field-label">ชื่อ</span>
                <input
                  className="field-input"
                  placeholder="เช่น สมชาย ใจดี"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(null) }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </label>
              <label className="field">
                <span className="field-label">ถนัดสายไหน</span>
                <select
                  className="field-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field">
              <span className="field-label">สี avatar</span>
              <div className="color-row">
                {MEMBER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-dot${c === color ? " is-active" : ""}`}
                    style={{ background: c }}
                    title={c}
                    onClick={() => setColor(c)}
                  >
                    {c === color && <IconCheck size={12} />}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="modal-error">{error}</p>}
          </section>
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>ปิด</button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            <IconPlus size={14} /> เพิ่มพนักงาน
          </button>
        </footer>
      </div>
    </div>
  )
}

/** ดึงรายชื่อจาก GitHub — เลือกได้ว่าจะเอาจาก repo หรือ organization */
function GithubImport({ onImported }: { onImported: () => void }) {
  const [source, setSource] = useState<"repo" | "org">("repo")
  const [repos, setRepos] = useState<GithubRepo[] | null>(null)
  const [orgs, setOrgs] = useState<GithubOrg[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setMessage(null)
    setError(null)
  }

  const load = async (next: "repo" | "org") => {
    setSource(next)
    reset()
    setBusy(true)
    try {
      if (next === "repo") {
        const rows = await getMyRepos()
        setRepos(rows)
        if (rows.length === 0) setMessage("ไม่เจอ repo ที่คุณมีสิทธิ์ push")
      } else {
        const rows = await getMyOrgs()
        setOrgs(rows)
        if (rows.length === 0) setMessage("บัญชีนี้ยังไม่ได้อยู่ organization ไหน")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดึงรายชื่อไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  const runImport = async (name: string) => {
    reset()
    setBusy(true)
    try {
      const result =
        source === "repo"
          ? await importRepoCollaborators(name)
          : await importOrgMembers(name)
      setMessage(`ดึงจาก ${result.org} แล้ว — เพิ่มใหม่ ${result.created} คน, อัปเดต ${result.updated} คน`)
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดึงรายชื่อไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  const rows =
    source === "repo"
      ? (repos ?? []).map((r) => ({ key: r.fullName, label: r.fullName, note: r.private ? "private" : "public" }))
      : (orgs ?? []).map((o) => ({ key: o.login, label: o.login, note: "organization" }))

  const loaded = source === "repo" ? repos !== null : orgs !== null

  return (
    <section className="modal-section">
      <h3 className="modal-h3">ดึงรายชื่อจาก GitHub</h3>

      <div className="gh-source">
        <button
          type="button"
          className={`gh-tab${source === "repo" ? " is-on" : ""}`}
          onClick={() => load("repo")}
          disabled={busy}
        >
          จาก repository
        </button>
        <button
          type="button"
          className={`gh-tab${source === "org" ? " is-on" : ""}`}
          onClick={() => load("org")}
          disabled={busy}
        >
          จาก organization
        </button>
      </div>

      {!loaded && !busy && (
        <p className="modal-hint">
          {source === "repo"
            ? "ดึง collaborator ทุกคนของ repo — เห็นทันทีที่ถูกเชิญ ไม่ต้องรอ commit"
            : "ดึงสมาชิกทั้งหมดของ organization"}
        </p>
      )}

      {busy && <p className="modal-hint">กำลังโหลด...</p>}

      {loaded && rows.length > 0 && (
        <ul className="member-list gh-list">
          {rows.map((r) => (
            <li key={r.key} className="member-row">
              <span className="member-info">
                <span className="member-name">{r.label}</span>
                <span className="member-role">{r.note}</span>
              </span>
              <button
                type="button"
                className="member-action"
                disabled={busy}
                onClick={() => runImport(r.key)}
              >
                ดึงสมาชิก
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && <p className="modal-hint">{message}</p>}
      {error && <p className="modal-error">{error}</p>}
    </section>
  )
}
