import type { ThemeId } from "../themes"
import { THEMES } from "../themes"
import { Menu, MenuItem, MenuLabel } from "./Menu"
import { IconCheck, IconChevronDown, IconPalette } from "./Icons"
import "./ThemePicker.css"

type Props = { value: ThemeId; onChange: (id: ThemeId) => void }

export function ThemePicker({ value, onChange }: Props) {
  const current = THEMES.find((t) => t.id === value) ?? THEMES[0]

  return (
    <Menu
      align="right"
      title="เปลี่ยนธีม"
      trigger={() => (
        <span className="theme-trigger">
          <IconPalette size={15} />
          {current.name}
          <IconChevronDown size={12} />
        </span>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>ธีมของ dashboard</MenuLabel>
          {THEMES.map((t) => (
            <MenuItem
              key={t.id}
              active={t.id === value}
              onClick={() => {
                onChange(t.id)
                close()
              }}
            >
              <span className="theme-swatch">
                {t.swatch.map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </span>
              <span className="menu-grow">{t.name}</span>
              {t.id === value && <IconCheck size={14} />}
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  )
}
