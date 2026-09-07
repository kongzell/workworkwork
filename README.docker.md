# Follow-up

บอร์ดติดตามงานที่ผูกกับ GitHub — แตกงานด้วย AI, ดึงทีมจาก collaborator ของ repo
และขยับการ์ดเองเมื่อมี commit หรือ merge PR

React 19 + TypeScript · FastAPI + SQLAlchemy (async) · PostgreSQL 18 · Gemini · GitHub OAuth

## เริ่มใช้งาน

สร้างไฟล์ `.env` ที่ root แล้ววางค่าข้างล่าง จากนั้น

```bash
docker compose up -d --build  # เปิด http://localhost:8081
```

โหมด dev (hot reload, เว็บไปพอร์ต 5173):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

> สลับโหมดแล้วต้องแก้ `GITHUB_CALLBACK_URL` ให้ตรงพอร์ต และเพิ่ม URL นั้นใน OAuth App

## .env

```bash
# --- Postgres (ใช้ตอนรันด้วย docker compose) ---
POSTGRES_USER=followup
POSTGRES_PASSWORD=followup
POSTGRES_DB=followup
DB_PORT=55432          # เลี่ยงชนกับ postgres ที่อาจมีอยู่แล้วในเครื่อง
API_PORT=3000
WEB_PORT=8081

# ตอน deploy ใส่ของ Neon แทน — วางทั้งเส้นรวม ?sslmode= ได้เลย
DATABASE_URL=

# --- Gemini: ขอ key ที่ https://aistudio.google.com/apikey ---
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
AI_MOCK=false          # true = ใช้ข้อมูลตัวอย่างแทนการเรียก Gemini

# --- GitHub OAuth: https://github.com/settings/developers ---
# Redirect URI ใน OAuth App ต้องตรงกับ GITHUB_CALLBACK_URL เป๊ะ
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:8081/api/auth/github/callback
GITHUB_REPO=           # owner/repo ที่จะดึง commit มาแสดง
GITHUB_WEBHOOK_SECRET= # ค่าเดียวกับที่ตั้งตอนสร้าง webhook

# --- ความลับ: ตอน deploy ต้องสุ่มใหม่ทั้งคู่ ---
SESSION_SECRET=dev-secret-change-me   # เซ็น session cookie
TOKEN_SECRET=                         # เข้ารหัส github_token (ว่าง = ยืม SESSION_SECRET)
CORS_ORIGIN=http://localhost:8081
```

เช็คว่าครบไหมที่ `/api/system/health` — ต้องได้ `databaseOk` · `authReady` · `secretsReady` เป็น `true`

## โครงสร้าง

```
frontend/              หน้าเว็บ (บอร์ด การ์ด แถบข้าง)
backend/app/routers/   endpoint ทั้งหมด
backend/app/models.py  ตาราง 6 ตัว (members projects tasks + ตารางเชื่อม)
backend/app/crypto.py  เข้ารหัส github_token ก่อนเก็บ
backend/app/db.py      แปลง DSN ของ Neon ให้ asyncpg ใช้ได้
backend/alembic/       migration — container รันให้เองตอน start
Dockerfile             image รวม frontend + API สำหรับ deploy
```

## สิทธิ์

ต้องล็อกอินก่อนถึงเรียก API ได้ · เห็นเฉพาะโปรเจคที่ตัวเองเป็นสมาชิก · คนที่ถูกเชิญเข้า repo ถูกใส่เข้าโปรเจคให้อัตโนมัติตอนล็อกอิน

| | เจ้าของ | สมาชิก |
| --- | --- | --- |
| เพิ่มงาน · AI แตกงาน · เพิ่มพนักงาน | ✅ | ❌ |
| ความสำคัญ · หมวดหมู่ · กำหนดส่ง · ลบงาน | ✅ | ❌ |
| ปิดงานเป็น "เสร็จแล้ว" | ✅ | ❌ |
| ย้าย รอเริ่ม/กำลังทำ/รอตรวจ · รับงาน | ✅ | ✅ |

คนนอกได้ `404` ไม่ใช่ `403` เพื่อไม่ยืนยันว่า id นั้นมีอยู่จริง

## รหัสงาน

การ์ดทุกใบมีรหัส `<รหัสย่อโปรเจค>-<เลข>` เช่น `KST-001` (รหัสย่อตั้งจากอักษรตัวแรกของชื่อ repo)

```bash
git commit -m "พัฒนา REST API สินค้า KST-003"   # การ์ดย้ายไป "รอตรวจ"
```

merge PR ที่อ้างรหัสนั้น → การ์ดเป็น **เสร็จแล้ว** · อ่านเฉพาะบรรทัดแรกของ commit และชื่อ/รายละเอียด PR

## คำสั่งที่ใช้บ่อย

```bash
docker compose logs -f api   # ดู log
docker compose down          # หยุด (ข้อมูลยังอยู่)
cd backend && alembic revision --autogenerate -m "..."   # migration ใหม่หลังแก้ models.py
```
