import { useEffect, useState } from "react"
import { importRepoCollaborators } from "../api"
import type { Member } from "../types"
import { Avatar } from "./Avatar"
import { IconClose, IconPlus, IconTrash } from "./Icons"
import "./Modal.css"

type Props = {
  projectName: string
  /** repo ที่โปรเจคนี้ผูกอยู่ เช่น "kongzell/...3" — null เมื่อสร้างโปรเจคเปล่า */
  githubRepo: string | null
  /** พนักงานที่อยู่ในโปรเจคนี้แล้ว */
  members: Member[]
  /** เจ้าของโปรเจค — ถอดออกไม่ได้ */
  ownerId: string | null
  /** พนักงานใน workspace ที่ยังไม่ได้อยู่ในโปรเจคนี้ */
  available: Member[]
  onClose: () => void
  onAddExisting: (memberId: string) => void
  onRemove: (memberId: string) => void
  /** เรียกหลังดึงรายชื่อจาก GitHub เสร็จ เพื่อให้ App โหลดพนักงานใหม่ */
  onImported: () => void
}

export function AddMemberModal({
  projectName, githubRepo, members, ownerId, available, onClose, onAddExisting, onRemove,
  onImported,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Add members to ${projectName}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2 className="modal-title">Add members to project</h2>
            <p className="modal-sub">{projectName}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} title="Close">
            <IconClose size={16} />
          </button>
        </header>

        <div className="modal-body">
          <section className="modal-section">
            <h3 className="modal-h3">In this project ({members.length})</h3>
            {members.length === 0 && <p className="modal-empty">Nobody in this project yet</p>}
            <ul className="member-list">
              {members.map((m) => (
                <li key={m.id} className="member-row">
                  <Avatar member={m} size={30} />
                  <span className="member-info">
                    <span className="member-name">
                      {m.name}
                      {m.id === ownerId && <span className="owner-tag">Owner</span>}
                    </span>
                    <span className="member-role">{m.role}</span>
                  </span>
                  <button
                    type="button"
                    className="member-action is-danger"
                    title="Remove from project"
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
              <h3 className="modal-h3">People in the workspace</h3>
              <ul className="member-list">
                {available.map((m) => (
                  <li key={m.id} className="member-row">
                    <Avatar member={m} size={30} />
                    <span className="member-info">
                      <span className="member-name">{m.name}</span>
                      <span className="member-role">{m.role}</span>
                    </span>
                    <button type="button" className="member-action" onClick={() => onAddExisting(m.id)}>
                      <IconPlus size={14} /> Add
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {githubRepo && <GithubImport repo={githubRepo} onImported={onImported} />}

        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  )
}

/** ซิงค์ collaborator ของ repo ที่โปรเจคนี้ผูกอยู่ — ใช้ตอนมีคนเข้า repo เพิ่มทีหลัง */
function GithubImport({ repo, onImported }: { repo: string; onImported: () => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sync = async () => {
    setMessage(null)
    setError(null)
    setBusy(true)
    try {
      const result = await importRepoCollaborators(repo)
      const pendingNote = result.pending > 0 ? ` (${result.pending} invite(s) still pending)` : ""
      setMessage(`Added ${result.created}, updated ${result.updated}${pendingNote}`)
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch member list")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="modal-section">
      <h3 className="modal-h3">Sync member from GitHub</h3>

      <button type="button" className="btn" disabled={busy} onClick={() => void sync()}>
        {busy ? "Loading..." : `Add collaborator from ${repo}`}
      </button>

      {!message && !error && (
        <p className="modal-hint">Use this when people join the repo after the project is created</p>
      )}
      {message && <p className="modal-hint">{message}</p>}
      {error && <p className="modal-error">{error}</p>}
    </section>
  )
}
