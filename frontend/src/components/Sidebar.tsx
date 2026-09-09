import type { Filters } from "../App"
import type { Member, Project } from "../types"
import { PRIORITIES } from "../types"
import { Avatar } from "./Avatar"
import { Menu, MenuItem, MenuLabel } from "./Menu"
import {
  IconCheck, IconChevronLeft, IconFilter, IconPlus, IconStar, IconTaskList, IconUsers,
} from "./Icons"
import "./Sidebar.css"

type Props = {
  projects: Project[]
  activeProjectId: string | null
  starredIds: string[]
  members: Member[]
  filters: Filters
  onChangeFilters: (f: Filters) => void
  onSelectProject: (id: string) => void
  onOpenAddProject: () => void
  onCollapse: () => void
}

export function Sidebar({
  projects, activeProjectId, starredIds, members, filters, onChangeFilters,
  onSelectProject, onOpenAddProject, onCollapse,
}: Props) {
  const filterOn = filters.assigneeId !== null || filters.priority !== null

  return (
    <aside className="sidebar">
      <div className="sb-top">  
        <div className="sb-top-actions">
          <Menu
            align="right"
            title="กรองงาน"
            trigger={() => (
              <span className={`sb-icon-btn${filterOn ? " is-on" : ""}`}>
                <IconFilter size={15} />
              </span>
            )}
          >
            {(close) => (
              <>
                <MenuLabel>ผู้รับผิดชอบ</MenuLabel>
                <MenuItem
                  active={filters.assigneeId === null}
                  onClick={() => onChangeFilters({ ...filters, assigneeId: null })}
                >
                  <span className="menu-grow">ทุกคน</span>
                  {filters.assigneeId === null && <IconCheck size={14} />}
                </MenuItem>
                {members.map((m) => (
                  <MenuItem
                    key={m.id}
                    active={filters.assigneeId === m.id}
                    onClick={() => onChangeFilters({ ...filters, assigneeId: m.id })}
                  >
                    <Avatar member={m} size={18} />
                    <span className="menu-grow">{m.name}</span>
                    {filters.assigneeId === m.id && <IconCheck size={14} />}
                  </MenuItem>
                ))}

                <MenuLabel>ความสำคัญ</MenuLabel>
                <MenuItem
                  active={filters.priority === null}
                  onClick={() => onChangeFilters({ ...filters, priority: null })}
                >
                  <span className="menu-grow">ทุกระดับ</span>
                  {filters.priority === null && <IconCheck size={14} />}
                </MenuItem>
                {PRIORITIES.filter((p) => p.id !== "none").map((p) => (
                  <MenuItem
                    key={p.id}
                    active={filters.priority === p.id}
                    onClick={() => onChangeFilters({ ...filters, priority: p.id })}
                  >
                    <span className="dot" style={{ background: p.color }} />
                    <span className="menu-grow">{p.label}</span>
                    {filters.priority === p.id && <IconCheck size={14} />}
                  </MenuItem>
                ))}

                {filterOn && (
                  <MenuItem
                    onClick={() => {
                      onChangeFilters({ assigneeId: null, priority: null })
                      close()
                    }}
                  >
                    ล้างตัวกรอง
                  </MenuItem>
                )}
              </>
            )}
          </Menu>

          <button type="button" className="sb-icon-btn" title="ย่อแถบข้าง" onClick={onCollapse}>
            <IconChevronLeft size={15} />
          </button>
        </div>
      </div>

      <section className="sb-section">
        <div className="sb-space">
          <div className="sb-row sb-space-head">
            <span className="sb-space-badge"><IconUsers size={12} /></span>
            Team Projects
            <button
              type="button"
              className="sb-icon-btn sb-row-end"
              title="เพิ่มโปรเจค"
              onClick={onOpenAddProject}
            >
              <IconPlus size={14} />
            </button>
          </div>

          <div className="sb-children">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`sb-row sb-child${p.id === activeProjectId ? " is-active" : ""}`}
                onClick={() => onSelectProject(p.id)}
              >
                <IconTaskList size={14} className="sb-glyph-list" />
                <span className="sb-child-name">{p.name}</span>
                {starredIds.includes(p.id) && <IconStar size={12} className="sb-star" />}
                <span className="sb-count">{p.tasks.length}</span>
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="sb-row sb-add" onClick={onOpenAddProject}>
          <IconPlus size={14} /> New Project
        </button>
      </section>
    </aside>
  )
}

