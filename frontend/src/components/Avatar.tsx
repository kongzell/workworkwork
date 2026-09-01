import type { Member } from "../types"
import { initialsOf } from "../types"
import "./Avatar.css"

type Props = { member: Member; size?: number; title?: string }

export function Avatar({ member, size = 22, title }: Props) {
  return (
    <span
      className="avatar"
      style={{ background: member.color, width: size, height: size, fontSize: size * 0.42 }}
      title={title ?? `${member.name} · ${member.role}`}
    >
      {initialsOf(member.name)}
    </span>
  )
}

/** avatar หลายคนซ้อนกัน — ถ้าเกิน max จะขึ้น +N */
export function AvatarStack({ members, size = 22, max = 4 }: { members: Member[]; size?: number; max?: number }) {
  const shown = members.slice(0, max)
  const rest = members.length - shown.length
  return (
    <span className="avatar-stack">
      {shown.map((m) => (
        <Avatar key={m.id} member={m} size={size} />
      ))}
      {rest > 0 && (
        <span
          className="avatar avatar-rest"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
          title={members.slice(max).map((m) => m.name).join(", ")}
        >
          +{rest}
        </span>
      )}
    </span>
  )
}
