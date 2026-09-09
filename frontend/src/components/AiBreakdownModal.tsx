import { useEffect, useState } from "react"
import type { BreakdownResult, SubtaskSuggestion } from "../api"
import { breakdownTask } from "../api"
import { categoryColor, COMPLEXITIES } from "../types"
import { IconCheck, IconClose, IconPlus, IconSparkle } from "./Icons"
import "./Modal.css"
import "./Ai.css"

type Props = {
  projectName: string
  onClose: () => void
  onAdd: (parentTitle: string, picked: SubtaskSuggestion[]) => void
}

export function AiBreakdownModal({ projectName, onClose, onAdd }: Props) {
  const [title, setTitle] = useState("")
  const [context, setContext] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BreakdownResult | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const run = async () => {
    const t = title.trim()
    if (!t) {
      setError("ใส่หัวข้องานที่จะให้แตกก่อน")
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await breakdownTask(t, context)
      setResult(data)
      setPicked(new Set(data.subtasks.map((_, i) => i)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "เรียก AI ไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  const toggle = (i: number) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const chosen = result ? result.subtasks.filter((_, i) => picked.has(i)) : []
  const totalHours = chosen.reduce((sum, s) => sum + s.estimateHours, 0)

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="กระจายงานด้วย AI"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2 className="modal-title"><IconSparkle size={16} /> กระจายงานด้วย AI</h2>
            <p className="modal-sub">{projectName}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} title="ปิด">
            <IconClose size={16} />
          </button>
        </header>

        <div className="modal-body">
          <div className="field">
            <span className="field-label">หัวข้องาน</span>
            <input
              autoFocus
              className="field-input"
              placeholder="เช่น ทำระบบตะกร้าสินค้า"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(null) }}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
          </div>

          <div className="field">
            <span className="field-label">ข้อมูลเพิ่มเติม (ไม่ใส่ก็ได้)</span>
            <input
              className="field-input"
              placeholder="เช่น ใช้ React + FastAPI, มีระบบสมาชิกอยู่แล้ว"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
          </div>

          <div className="ai-run">
            <button type="button" className="btn btn-primary" onClick={run} disabled={loading}>
              {loading ? "กำลังคิด..." : <><IconSparkle size={14} /> กระจายงาน</>}
            </button>
          </div>

          {error && <p className="modal-error">{error}</p>}

          {result?.mock && (
            <p className="ai-banner">
              โหมดตัวอย่าง — ยังไม่ได้ตั้ง <code>GEMINI_API_KEY</code> ผลลัพธ์นี้เป็นข้อมูลปลอมที่เขียนไว้ในโค้ด
            </p>
          )}

          {result && (
            <section className="modal-section">
              <h3 className="modal-h3">{result.summary}</h3>
              <ul className="ai-list">
                {result.subtasks.map((s, i) => (
                  <li key={`${s.title}-${i}`} className={`ai-item${picked.has(i) ? " is-picked" : ""}`}>
                    <button
                      type="button"
                      className="ai-check"
                      aria-pressed={picked.has(i)}
                      onClick={() => toggle(i)}
                    >
                      {picked.has(i) && <IconCheck size={12} />}
                    </button>

                    <div className="ai-info">
                      <div className="ai-title">{s.title}</div>
                      <div className="ai-chips">
                        <span className="ai-cat" style={{ color: categoryColor(s.category) }}>
                          {s.category}
                        </span>
                        {s.tags.map((t) => (
                          <span key={t} className="ai-tag">{t}</span>
                        ))}
                        <span className="ai-est">{s.estimateHours} ชม.</span>
                        <span
                          className="ai-cx"
                          style={{ color: COMPLEXITIES.find((c) => c.id === s.complexity)?.color }}
                        >
                          {COMPLEXITIES.find((c) => c.id === s.complexity)?.label}
                        </span>
                      </div>
                      {s.reason && <p className="ai-reason">{s.reason}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="modal-foot">
          {result && (
            <span className="ai-total">
              เลือก {chosen.length} งาน · รวม {totalHours.toFixed(1)} ชม.
            </span>
          )}
          <button type="button" className="btn" onClick={onClose}>ปิด</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={chosen.length === 0}
            onClick={() => { onAdd(title.trim(), chosen); onClose() }}
          >
            <IconPlus size={14} /> เพิ่มเข้าโปรเจค
          </button>
        </footer>
      </div>
    </div>
  )
}
