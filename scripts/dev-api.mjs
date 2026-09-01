// รัน FastAPI ด้วย python ของ venv โดยไม่ต้อง activate ก่อน
//
// ถ้าเรียก `uvicorn` ตรง ๆ npm จะหยิบตัวที่อยู่ใน PATH ซึ่งมักเป็น python ตัวหลักของเครื่อง
// ที่ไม่ได้ลง dependency ของโปรเจคไว้ แล้วจะพังด้วย ImportError ที่งงมาก
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

const isWindows = process.platform === "win32"
const venvPython = join("backend", ".venv", isWindows ? "Scripts" : "bin", isWindows ? "python.exe" : "python")

const python = existsSync(venvPython) ? venvPython : "python"
if (python === "python") {
  console.warn(
    `[dev:api] ไม่เจอ venv ที่ ${venvPython} — จะใช้ python จาก PATH แทน\n` +
      "[dev:api] ถ้าพังเพราะ ImportError ให้สร้าง venv ก่อน: python -m venv backend/.venv",
  )
}

const port = process.env.API_PORT ?? "3000"
const child = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--reload", "--reload-dir", "backend/app", "--port", port],
  { stdio: "inherit" },
)

child.on("exit", (code) => process.exit(code ?? 0))
