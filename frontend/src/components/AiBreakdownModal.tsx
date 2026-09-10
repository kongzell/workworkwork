import { useEffect, useState } from "react"
import type { BreakdownResult, SubtaskSuggestion } from "../api"
import { breakdownTask } from "../api"
import { categoryColor, COMPLEXITIES } from "../types"
import { IconCheck, IconChevronDown, IconClose, IconPlus, IconSparkle } from "./Icons"
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
  // ซ่อนรายละเอียดไว้ก่อน — ตอนเลือกงานดูแค่ชื่อกับความยากพอ
  // ถ้ากางทุกใบ งานย่อย 5 ใบจะยาวจนต้องเลื่อนหาปุ่มยืนยัน
  const [openDesc, setOpenDesc] = useState<Set<number>>(new Set())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const run = async () => {
    const t = title.trim()
    if (!t) {
      setError("Enter what you want broken down first")
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await breakdownTask(t, context)
      setResult(data)
      setPicked(new Set(data.subtasks.map((_, i) => i)))
      setOpenDesc(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : "The AI request failed")
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
        aria-label="Break down work with AI"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2 className="modal-title"><IconSparkle size={16} /> Break down work with AI</h2>
            <p className="modal-sub">{projectName}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} title="Close">
            <IconClose size={16} />
          </button>
        </header>

        <div className="modal-body">
          <div className="field">
            <span className="field-label">What to build</span>
            <input
              autoFocus
              className="field-input"
              placeholder="e.g. build a shopping cart"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(null) }}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
          </div>

          <div className="field">
            <span className="field-label">More context (optional)</span>
            <input
              className="field-input"
              placeholder="e.g. React + FastAPI, auth already exists"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
          </div>

          <div className="ai-run">
            <button type="button" className="btn btn-primary" onClick={run} disabled={loading}>
              {loading ? "Thinking..." : <><IconSparkle size={14} /> Break down</>}
            </button>
          </div>

          {error && <p className="modal-error">{error}</p>}

          {result?.mock && (
            <p className="ai-banner">
              Demo mode — <code>GEMINI_API_KEY</code> is not set, so these results are hard-coded samples
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
                      {s.description ? (
                        <button
                          type="button"
                          className="ai-title is-toggle"
                          aria-expanded={openDesc.has(i)}
                          title="Show what this task covers"
                          onClick={() =>
                            setOpenDesc((cur) => {
                              const next = new Set(cur)
                              if (!next.delete(i)) next.add(i)
                              return next
                            })
                          }
                        >
                          <IconChevronDown
                            size={12}
                            className={openDesc.has(i) ? "ai-caret is-open" : "ai-caret"}
                          />
                          {s.title}
                        </button>
                      ) : (
                        <div className="ai-title">{s.title}</div>
                      )}
                      <div className="ai-chips">
                        <span className="ai-cat" style={{ color: categoryColor(s.category) }}>
                          {s.category}
                        </span>
                        {s.tags.map((t) => (
                          <span key={t} className="ai-tag">{t}</span>
                        ))}
                        <span className="ai-est">{s.estimateHours} h</span>
                        <span
                          className="ai-cx"
                          style={{ color: COMPLEXITIES.find((c) => c.id === s.complexity)?.color }}
                        >
                          {COMPLEXITIES.find((c) => c.id === s.complexity)?.label}
                        </span>
                      </div>
                      {s.reason && <p className="ai-reason">{s.reason}</p>}
                      {openDesc.has(i) && <p className="ai-desc">{s.description}</p>}
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
              {chosen.length} selected · {totalHours.toFixed(1)} h total
            </span>
          )}
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={chosen.length === 0}
            onClick={() => { onAdd(title.trim(), chosen); onClose() }}
          >
            <IconPlus size={14} /> Add to project
          </button>
        </footer>
      </div>
    </div>
  )
}
