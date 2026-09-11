# workworkwork

บอร์ดติดตามงานที่ผูกกับ GitHub — แตกงานด้วย AI, ดึงทีมจาก collaborator ของ repo
ขยับการ์ดเองเมื่อมี commit หรือ merge PR แจ้งเตือนทางอีเมล และมีแดชบอร์ดให้หัวหน้าดูภาพรวม

React 19 + TypeScript · FastAPI + SQLAlchemy (async) · PostgreSQL 18 · Gemini · GitHub OAuth · Brevo

## ทำอะไรได้บ้าง

- **บอร์ด Kanban** รอเริ่ม / กำลังทำ / รอตรวจ / เสร็จแล้ว — จัดกลุ่มตามคน หมวดหมู่ หรือความสำคัญได้
- **แตกงานด้วย AI** พิมพ์สิ่งที่อยากได้ Gemini แตกเป็นการ์ดพร้อมรายละเอียด หมวดหมู่ เวลาประเมิน
  แก้ทุกช่องได้ก่อนกดเพิ่ม และตอบเป็นภาษาเดียวกับที่สั่ง
- **GitHub** ล็อกอินด้วย GitHub, ดึงทีมจาก collaborator, webhook ย้ายการ์ดตามรหัสงานใน commit/PR
- **แจ้งเตือนอีเมล** เมื่อมีงานใหม่และมีคนรับงาน (ใครอยากรับก็กรอกอีเมลในเมนูโปรไฟล์)
- **แดชบอร์ด** ภาพรวมโปรเจค + รายคน (งานเสร็จ ส่งตรงเวลา โดนตีกลับ ภาระงาน) ไว้ประกอบการประเมิน
- **โน้ตใต้การ์ด** คนรับงานจดปัญหา/แนวทางแก้ไว้ให้หัวหน้าเห็น
- **admin ของโปรเจค** เจ้าของตั้งสมาชิกให้มีสิทธิ์เท่าตัวเองในเว็บได้ (ไม่เกี่ยวกับสิทธิ์บน GitHub)

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

DATABASE_URL=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
AI_MOCK=false          # true = ใช้ข้อมูลตัวอย่างแทนการเรียก Gemini

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:8081/api/auth/github/callback
GITHUB_REPO=           # owner/repo ที่จะดึง commit มาแสดง
GITHUB_WEBHOOK_SECRET= # ค่าเดียวกับที่ตั้งตอนสร้าง webhook

# --- ความลับ: ตอน deploy ต้องสุ่มใหม่ทั้งคู่ ---
SESSION_SECRET=dev-secret-change-me   # เซ็น session cookie
TOKEN_SECRET=                         # เข้ารหัส github_token (ว่าง = ยืม SESSION_SECRET)
CORS_ORIGIN=http://localhost:8081

BREVO_API_KEY=
MAIL_FROM=             # อีเมลผู้ส่งที่ยืนยันใน Brevo แล้ว
MAIL_FROM_NAME=3work
APP_URL=http://localhost:8081   # ลิงก์กลับมาที่บอร์ดในอีเมล — ตอน deploy ใส่ URL จริง
```

> ใช้ HTTPS API ของ Brevo ไม่ใช่ SMTP เพราะ Render บล็อกพอร์ต 587 ขาออก · ฟรี 300 ฉบับ/วัน

## โครงสร้าง

```
frontend/              หน้าเว็บ (บอร์ด การ์ด แถบข้าง แดชบอร์ด)
backend/app/routers/   endpoint ทั้งหมด (auth github projects tasks members ai system)
backend/app/models.py  ตาราง 7 ตัว (members projects tasks task_comments webhook_events + ตารางเชื่อม)
backend/app/ai.py      คุยกับ Gemini — แตกงาน / เดาว่า commit ตรงกับงานไหน
backend/app/notify.py  เนื้อหาอีเมล + หาผู้รับ · mailer.py ส่งผ่าน Brevo
backend/app/crypto.py  เข้ารหัส github_token ก่อนเก็บ
backend/app/db.py      แปลง DSN ของ Neon ให้ asyncpg ใช้ได้
backend/alembic/       migration — container รันให้เองตอน start
Dockerfile             image รวม frontend + API สำหรับ deploy
render.yaml            ค่าตั้งสำหรับ Render (env ทั้งหมดที่ต้องกรอก)
```

## สิทธิ์

สิทธิ์เป็นรายโปรเจค — คนเดียวกันเป็นเจ้าของโปรเจคหนึ่งและสมาชิกธรรมดาในอีกโปรเจคได้
เจ้าของตั้ง **admin** ได้จากหน้า Add member (สิทธิ์ในเว็บอย่างเดียว ไม่แตะ collaborator บน GitHub)

## รหัสงาน

การ์ดทุกใบมีรหัส `<รหัสย่อโปรเจค>-<เลข>` เช่น `KST-001` (รหัสย่อตั้งจากอักษรตัวแรกของชื่อ repo)

```bash
git commit -m "พัฒนา REST API สินค้า KST-003"   # การ์ดย้ายไป "รอตรวจ"
```
merge PR ที่อ้างรหัสนั้น → การ์ดเป็น **เสร็จแล้ว** · อ่านเฉพาะบรรทัดแรกของ commit และชื่อ/รายละเอียด PR

push ขึ้น branch ไหนก็นับ (ไม่ต้องรอ merge เข้า main) · คนที่ทำคือ author ของ commit ไม่ใช่คน push

commit ที่ลืมใส่รหัส Gemini จะเดาให้ว่าตรงกับงานใบไหน แล้วขึ้นเป็นข้อเสนอในแถบ GitHub Activity
พร้อมเหตุผลและระดับความมั่นใจ — **ไม่ย้ายการ์ดเอง** เจ้าของหรือ admin ต้องกดยืนยันก่อน

งานที่ปิดแล้วถูกดันกลับมาทำใหม่จะติดป้าย "Rework" และนับจำนวนครั้งไว้ให้ดูในแดชบอร์ด

## แจ้งเตือนอีเมล

| เหตุการณ์ | ส่งถึง |
| --- | --- |
| สร้างงานใหม่ | สมาชิกทุกคนในโปรเจค ยกเว้นคนสร้าง |
| มีคนรับงาน | เจ้าของโปรเจคกับคนที่ถูก assign ยกเว้นคนกดเอง |

ส่งเฉพาะคนที่กรอกอีเมลไว้ในเมนูโปรไฟล์ — ไม่กรอกถือว่าไม่รับแจ้งเตือน
ถ้าไม่มีอีเมลออก ดู `docker compose logs api` จะบอกเหตุผล (logger `notify` / `mailer`)

## Deploy (Render + Neon)

image เดียวตาม `Dockerfile` — ตอน start รัน `alembic upgrade head` แล้วเสิร์ฟทั้ง API และหน้าเว็บ
ค่า env ทั้งหมดอยู่ใน `render.yaml` · `DATABASE_URL` ใส่ของ Neon · `GITHUB_CALLBACK_URL`, `APP_URL`, `CORS_ORIGIN` ใส่ URL ของ Render
push ขึ้น `master` แล้ว Render build ให้เอง