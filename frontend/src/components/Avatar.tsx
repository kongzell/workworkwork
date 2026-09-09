import type { Member } from "../types"
import { initialsOf } from "../types"
import "./Avatar.css"

type Props = { member: Member; size?: number; title?: string }

export function Avatar({ member, size = 22, title }: Props) {
  return (
    <span
      className="avatar"
      style={{ background: member.color, width: size, height: size, fontSize: size * 0.44 }}
      title={title ?? `${member.name} · ${member.role}`}
    >
      {initialsOf(member.name)}
    </span>
  )
}
