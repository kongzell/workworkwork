# Follow-up

บอร์ดติดตามงานที่ผูกกับ GitHub — แตกงานด้วย AI, ดึงทีมจาก collaborator ของ repo
และขยับการ์ดเองเมื่อมี commit หรือ merge PR

React 19 + TypeScript · FastAPI + SQLAlchemy (async) · PostgreSQL 18 · Gemini · GitHub OAuth

## เริ่มใช้งาน

```bash
cp .env.example .env          # แล้วเติมค่าตามตารางข้างล่าง
docker compose up -d --build  # เปิด http://localhost:8081
```

โหมด dev (hot reload, เว็บย้ายไปพอร์ต 5173):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

> สลับโหมดแล้วต้องแก้ `GITHUB_CALLBACK_URL` ให้ตรงพอร์ต และเพิ่ม URL นั้นใน OAuth App ด้วย

## ตัวแปรใน .env

| ตัวแปร | ใส่อะไร |
| --- | --- |
| `DATABASE_URL` | ปล่อยว่างได้ตอนใช้ docker · ตอน deploy ใส่ของ Neon (วางทั้งเส้นรวม `?sslmode=`) |
| `SESSION_SECRET` | ใช้เซ็น cookie — **ตอน deploy ต้องสุ่มใหม่** |
| `TOKEN_SECRET` | ใช้เข้ารหัส GitHub token ในฐานข้อมูล |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | จาก OAuth App |
| `GITHUB_CALLBACK_URL` | ต้องตรงกับ Redirect URI ใน OAuth App เป๊ะ |
| `GITHUB_REPO` | `owner/repo` ที่จะดึง commit มาแสดง |
| `GITHUB_WEBHOOK_SECRET` | ค่าเดียวกับที่ตั้งตอนสร้าง webhook |
| `GEMINI_API_KEY` | จาก aistudio.google.com |

เช็คว่าครบไหมที่ `/api/system/health` — ต้องได้ `databaseOk` · `authReady` · `secretsReady` เป็น `true`

## โครงสร้าง

```
frontend/            หน้าเว็บ (บอร์ด การ์ด แถบข้าง)
backend/app/
  routers/           endpoint ทั้งหมด
  models.py          ตาราง 6 ตัว: members projects tasks
                     project_members task_assignees webhook_events
  crypto.py          เข้ารหัส github_token ก่อนเก็บ
  db.py              แปลง DSN ของ Neon ให้ asyncpg ใช้ได้
backend/alembic/     migration — container รัน upgrade head ให้เองตอน start
Dockerfile           image รวม frontend + API สำหรับ deploy
docker-compose.yml   รันครบชุดในเครื่อง
```

## สิทธิ์

ต้องล็อกอินก่อนถึงเรียก API ได้ และเห็นเฉพาะโปรเจคที่ตัวเองเป็นสมาชิก
คนที่ถูกเชิญเข้า repo จะถูกใส่เข้าโปรเจคให้อัตโนมัติตอนล็อกอิน

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

merge PR ที่อ้างรหัสนั้น → การ์ดเป็น **เสร็จแล้ว** · งานที่ปิดแล้วไม่ถูกดึงกลับ
อ่านเฉพาะบรรทัดแรกของ commit message และชื่อ/รายละเอียด PR

## คำสั่งที่ใช้บ่อย

```bash
docker compose logs -f api   # ดู log
docker compose down          # หยุด (ข้อมูลยังอยู่)
docker compose down -v       # หยุด + ลบข้อมูล
cd backend && alembic revision --autogenerate -m "..."   # migration ใหม่หลังแก้ models.py
```