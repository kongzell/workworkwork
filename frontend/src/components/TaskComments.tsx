import { useEffect, useState } from "react"
import type { TaskComment } from "../api"
import { addComment, deleteComment, getComments } from "../api"
import { IconTrash } from "./Icons"
import "./TaskComments.css"

type Props = {
  taskId: string
  /** id ของคนที่ล็อกอินอยู่ — null เมื่อยังไม่ล็อกอิน */
  currentMemberId: string | null
  /** เขียนคอมเมนต์ได้ไหม — คนที่รับงานใบนี้ กับเจ้าของโปรเจคเท่านั้น */
  canWrite: boolean
  /** เจ้าของโปรเจคลบคอมเมนต์ของใครก็ได้ */
  canManage: boolean
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

/** บันทึกใต้การ์ด — โหลดตอนกางการ์ดเท่านั้น
 *
 * ไม่ได้ดึงมาพร้อมบอร์ดทั้งกระดาน เพราะการ์ดส่วนใหญ่ไม่ถูกกางดู
 * ดึงมาหมดจะเสียเวลาโหลดกับข้อมูลที่ไม่มีใครอ่าน
 */
export function TaskComments({ taskId, currentMemberId, canWrite, canManage }: Props) {
  const [rows, setRows] = useState<TaskComment[] | null>(null)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getComments(taskId)
      .then((data) => alive && setRows(data))
      .catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [taskId])

  const submit = async () => {
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    setError(null)
    try {
      const saved = await addComment(taskId, body)
      setRows((cur) => [...(cur ?? []), saved])
      setDraft("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post the comment")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await deleteComment(taskId, id)
      setRows((cur) => (cur ?? []).filter((r) => r.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the comment")
    }
  }

  return (
    <div className="cd-block">
      <span className="cd-label">Notes {rows && rows.length > 0 && `· ${rows.length}`}</span>

      {rows === null ? (
        <p className="tc-empty">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="tc-empty">
          {canWrite ? "No notes yet — write down anything you get stuck on" : "No notes yet"}
        </p>
      ) : (
        <ul className="tc-list">
          {rows.map((c) => (
            <li key={c.id} className="tc-row">
              <div className="tc-head">
                <span className="tc-who">{c.memberName}</span>
                <span className="tc-when">{fmtWhen(c.createdAt)}</span>
                {(canManage || c.memberId === currentMemberId) && (
                  <button
                    type="button"
                    className="tc-del"
                    title="Delete this note"
                    onClick={() => void remove(c.id)}
                  >
                    <IconTrash size={12} />
                  </button>
                )}
              </div>
              <p className="tc-body">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="tc-form">
          <textarea
            className="tc-input"
            rows={2}
            value={draft}
            placeholder="What are you stuck on, and how will you fix it?"
            onChange={(e) => setDraft(e.target.value)}
            // Enter ส่งเลย · Shift+Enter ขึ้นบรรทัดใหม่ เหมือนช่องแชตทั่วไป
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
            }}
          />
          <button
            type="button"
            className="tc-send"
            disabled={busy || draft.trim() === ""}
            onClick={() => void submit()}
          >
            {busy ? "..." : "Post"}
          </button>
        </div>
      )}

      {error && <p className="tc-error">{error}</p>}
    </div>
  )
}
