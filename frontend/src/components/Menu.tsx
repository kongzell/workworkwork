import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import "./Menu.css"

type Props = {
  /** ปุ่มที่กดแล้วเปิดเมนู */
  trigger: (open: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  align?: "left" | "right"
  title?: string
}

/** dropdown เล็ก ๆ ที่ปิดเองเมื่อคลิกนอกเมนูหรือกด Esc */
export function Menu({ trigger, children, align = "left", title }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="menu-trigger"
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {trigger(open)}
      </button>
      {open && (
        <div className={`menu-pop menu-${align}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  children,
  onClick,
  active,
  danger,
}: {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu-item${active ? " is-active" : ""}${danger ? " is-danger" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="menu-label">{children}</div>
}
