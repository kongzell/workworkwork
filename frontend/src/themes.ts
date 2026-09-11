export type ThemeId = "midnight" | "light" | "ocean" | "forest" | "sunset"

export type Theme = {
  id: ThemeId
  name: string
  /** สีตัวอย่างที่โชว์ในเมนูเลือกธีม: [พื้นหลัง, การ์ด, สีหลัก] */
  swatch: [string, string, string]
}

export const THEMES: Theme[] = [
  { id: "midnight", name: "Midnight", swatch: ["#141414", "#232323", "#7b68ee"] },
  { id: "light", name: "Light", swatch: ["#ffffff", "#f1f1f3", "#7b68ee"] },
  { id: "ocean", name: "Ocean", swatch: ["#0d1524", "#182742", "#38bdf8"] },
  { id: "forest", name: "Forest", swatch: ["#101613", "#1c2822", "#22c55e"] },
  { id: "sunset", name: "Sunset", swatch: ["#191316", "#2a2124", "#f97316"] },
]

const KEY = "3work-theme"
const isTheme = (v: string | null): v is ThemeId => THEMES.some((t) => t.id === v)

export function loadTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(KEY)
    if (isTheme(saved)) return saved
  } catch {
    /* โหมดส่วนตัว / ปิด site data — ใช้ค่า default ไป */
  }
  return "midnight"
}

export function saveTheme(id: ThemeId) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* บันทึกไม่ได้ก็ไม่เป็นไร ธีมยังใช้ได้ในรอบนี้ */
  }
}
