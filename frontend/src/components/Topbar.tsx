import { useState } from "react"
import type { RefObject } from "react"
import type { AuthStatus } from "../api"
import type { Member, Project } from "../types"
import { ROLES } from "../types"
import type { ThemeId } from "../themes"
import { AvatarStack } from "./Avatar"
import { Menu, MenuItem, MenuLabel } from "./Menu"
import { ThemePicker } from "./ThemePicker"
import {
  IconCheck, IconChevronDown, IconChevronRight, IconGithub, IconLayers, IconPencil,
  IconPlus, IconSearch, IconStar, IconTaskList, IconTrash, IconUsers,
} from "./Icons"
import "./Topbar.css"

type Props = {
  project: Project
  projects: Project[]
  taskCount: number
  members: Member[]
  query: string
  searchRef: RefObject<HTMLInputElement | null>
  starred: boolean
  collapsed: boolean
  theme: ThemeId
  canDelete: boolean
  groupBy: "status" | "category"
  auth: AuthStatus | null
  onChangeGroupBy: (g: "status" | "category") => void
  onDevLogin: () => void
  onLogout: () => void
  onChangeRole: (role: string) => void
  onQueryChange: (q: string) => void
  onSelectProject: (id: string) => void
  onRenameProject: (name: string) => void
  onDeleteProject: () => void
  onToggleStar: () => void
  onExpand: () => void
  onChangeTheme: (id: ThemeId) => void
  onAddMember: () => void
}

export function Topbar({
  project, projects, taskCount, members, query, searchRef, starred, collapsed, theme,
  canDelete, groupBy, auth, onChangeGroupBy, onDevLogin, onLogout, onChangeRole, onQueryChange,
  onSelectProject, onRenameProject, onDeleteProject, onToggleStar, onExpand,
  onChangeTheme, onAddMember,
}: Props) {
  const [renaming, setRenaming] = useState(false)

  return (
    <header className="topbar">
      <div className="tb-row">
        {collapsed && (
          <button type="button" className="tb-icon-btn" title="กางแถบข้าง" onClick={onExpand}>
            <IconChevronRight size={16} />
          </button>
        )}

        <nav className="tb-crumbs">
          <span className="tb-crumb">
            <span className="tb-crumb-badge"><IconUsers size={11} /></span> Team Projects
          </span>
          <span className="tb-sep">/</span>

          {renaming ? (
            <RenameInput
              value={project.name}
              onSubmit={(name) => {
                onRenameProject(name)
                setRenaming(false)
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <Menu
              align="left"
              title="เมนูโปรเจค"
              trigger={() => (
                <span className="tb-crumb tb-crumb-current">
                  <IconTaskList size={14} className="tb-crumb-list" /> {project.name}
                  <IconChevronDown size={13} />
                </span>
              )}
            >
              {(close) => (
                <>
                  <MenuLabel>สลับโปรเจค</MenuLabel>
                  {projects.map((p) => (
                    <MenuItem
                      key={p.id}
                      active={p.id === project.id}
                      onClick={() => { onSelectProject(p.id); close() }}
                    >
                      <IconTaskList size={14} />
                      <span className="menu-grow">{p.name}</span>
                      {p.id === project.id && <IconCheck size={14} />}
                    </MenuItem>
                  ))}

                  <MenuLabel>จัดการ</MenuLabel>
                  <MenuItem onClick={() => { setRenaming(true); close() }}>
                    <IconPencil size={14} /> เปลี่ยนชื่อโปรเจค
                  </MenuItem>
                  {canDelete && (
                    <MenuItem danger onClick={() => { onDeleteProject(); close() }}>
                      <IconTrash size={14} /> ลบโปรเจคนี้
                    </MenuItem>
                  )}
                </>
              )}
            </Menu>
          )}

          <span className="tb-count">{taskCount} งาน</span>

          <button
            type="button"
            className={`tb-icon-btn tb-star${starred ? " is-on" : ""}`}
            title={starred ? "เอาดาวออก" : "ติดดาวโปรเจคนี้"}
            aria-pressed={starred}
            onClick={onToggleStar}
          >
            <IconStar size={15} />
          </button>
        </nav>

        <div className="tb-actions">
          <Menu
            align="right"
            title="จัดกลุ่มคอลัมน์"
            trigger={() => (
              <span className="tb-group">
                <IconLayers size={14} />
                {groupBy === "status" ? "สถานะ" : "หมวดหมู่"}
                <IconChevronDown size={12} />
              </span>
            )}
          >
            {(close) => (
              <>
                <MenuLabel>จัดคอลัมน์ตาม</MenuLabel>
                <MenuItem
                  active={groupBy === "status"}
                  onClick={() => { onChangeGroupBy("status"); close() }}
                >
                  <span className="menu-grow">สถานะ</span>
                  {groupBy === "status" && <IconCheck size={14} />}
                </MenuItem>
                <MenuItem
                  active={groupBy === "category"}
                  onClick={() => { onChangeGroupBy("category"); close() }}
                >
                  <span className="menu-grow">หมวดหมู่ (Frontend / Backend / ...)</span>
                  {groupBy === "category" && <IconCheck size={14} />}
                </MenuItem>
              </>
            )}
          </Menu>

          <label className="tb-search">
            <IconSearch size={14} />
            <input
              ref={searchRef}
              type="search"
              placeholder="ค้นหางาน"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </label>
          <AvatarStack members={members} size={24} />
          <button type="button" className="tb-add-member" onClick={onAddMember}>
            <IconPlus size={14} /> เพิ่มพนักงาน
          </button>
          <span className="tb-divider" />
          <AuthChip auth={auth} onDevLogin={onDevLogin} onLogout={onLogout} onChangeRole={onChangeRole} />
          <ThemePicker value={theme} onChange={onChangeTheme} />
        </div>
      </div>
    </header>
  )
}

function RenameInput({
  value,
  onSubmit,
  onCancel,
}: {
  value: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(value)

  const commit = () => {
    const next = name.trim()
    if (next) onSubmit(next)
    else onCancel()
  }

  return (
    <input
      autoFocus
      className="tb-rename"
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit()
        if (e.key === "Escape") onCancel()
      }}
    />
  )
}

/** ปุ่มเข้าสู่ระบบ / ชิปแสดงคนที่ล็อกอินอยู่ */
function AuthChip({
  auth,
  onDevLogin,
  onLogout,
  onChangeRole,
}: {
  auth: AuthStatus | null
  onDevLogin: () => void
  onLogout: () => void
  onChangeRole: (role: string) => void
}) {
  if (auth === null) return null

  if (auth.member) {
    return (
      <Menu
        align="right"
        title="บัญชีของฉัน"
        trigger={() => (
          <span className="tb-user">
            {auth.member?.avatarUrl ? (
              <img className="tb-user-img" src={auth.member.avatarUrl} alt="" />
            ) : (
              <span className="tb-user-dot" style={{ background: auth.member?.color }} />
            )}
            {auth.member?.name}
          </span>
        )}
      >
        {(close) => (
          <>
            {auth.member?.githubLogin && <MenuLabel>@{auth.member.githubLogin}</MenuLabel>}

            <MenuLabel>บทบาทของฉัน</MenuLabel>
            {ROLES.map((r) => (
              <MenuItem
                key={r}
                active={r === auth.member?.role}
                onClick={() => { onChangeRole(r); close() }}
              >
                <span className="menu-grow">{r}</span>
                {r === auth.member?.role && <IconCheck size={14} />}
              </MenuItem>
            ))}

            <MenuItem onClick={() => { onLogout(); close() }}>ออกจากระบบ</MenuItem>
          </>
        )}
      </Menu>
    )
  }

  if (auth.configured) {
    return (
      <a className="tb-login" href="/api/auth/github">
        <IconGithub size={14} /> เข้าสู่ระบบด้วย GitHub
      </a>
    )
  }

  if (auth.devLogin) {
    return (
      <button
        type="button"
        className="tb-login"
        title="ยังไม่ได้ตั้ง OAuth App — เข้าสู่ระบบด้วยพนักงานคนแรกเพื่อทดสอบ"
        onClick={onDevLogin}
      >
        <IconGithub size={14} /> เข้าสู่ระบบ (ทดสอบ)
      </button>
    )
  }

  return <span className="tb-login is-off" title="ตั้ง GITHUB_CLIENT_ID ใน .env ก่อน">ยังไม่เปิดใช้ login</span>
}
