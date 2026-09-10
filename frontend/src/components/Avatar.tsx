import type { Member } from "../types"
import { initialsOf } from "../types"
import "./Avatar.css"

type Props = { member: Member; size?: number; title?: string }

export function Avatar({ member, size = 22, title }: Props) {
  const label = title ?? `${member.name} · ${member.role}`

  // คนที่เจ้าของสร้างเองด้วยมือไม่มีรูปจาก GitHub ต้องเหลือตัวย่อไว้เป็นตัวสำรอง
  // ไม่งั้นจะกลายเป็นวงกลมว่างเปล่าที่แยกไม่ออกว่าเป็นใคร
  if (member.avatarUrl) {
    return (
      <img
        className="avatar avatar-img"
        src={member.avatarUrl}
        alt=""
        width={size}
        height={size}
        title={label}
      />
    )
  }

  return (
    <span
      className="avatar"
      style={{ background: member.color, width: size, height: size, fontSize: size * 0.44 }}
      title={label}
    >
      {initialsOf(member.name)}
    </span>
  )
}
