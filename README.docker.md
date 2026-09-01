# การรันด้วย Docker

## เตรียมตัวครั้งแรก

```bash
cp .env.example .env
```

## โหมด production (nginx + uvicorn)

```bash
docker compose up -d --build
```

| service | คำอธิบาย | URL |
| --- | --- | --- |
| `web` | nginx เสิร์ฟไฟล์ที่ vite build แล้ว + proxy `/api` ไปที่ `api` | http://localhost:8081 |
| `api` | FastAPI (uvicorn) | http://localhost:3000/api/health |
| `db`  | PostgreSQL 18 (เก็บข้อมูลใน volume `db-data`) | localhost:5432 |

เพราะ nginx proxy `/api` ให้แล้ว หน้าเว็บกับ API จึงอยู่ origin เดียวกัน — ไม่ต้องพึ่ง CORS

หน้า Swagger อยู่ที่ http://localhost:8081/api/docs (วางไว้ใต้ `/api` เพื่อให้ผ่าน proxy ได้)

## โหมด dev (hot reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- vite dev server: http://localhost:5173 (proxy `/api` ไปที่ container `api`)
- API: http://localhost:3000/api/health · docs: http://localhost:5173/api/docs
- `backend/app` และ `frontend` ถูก bind mount เข้า container — แก้โค้ดแล้วรีโหลดเอง

> ถ้า hot reload ไม่ทำงาน: bind mount จาก Windows filesystem บางทีไม่ส่ง inotify event —
> compose เปิด polling ให้แล้ว (`VITE_POLLING`, `WATCHFILES_FORCE_POLLING`) ถ้ายังไม่ติดให้รันบนเครื่องแทน

## รันบนเครื่อง (ไม่ผ่าน docker)

ครั้งแรก สร้าง venv แล้วลง dependency:

```bash
python -m venv backend/.venv && backend/.venv/Scripts/activate && pip install -r backend/requirements-dev.txt
```

จากนั้น (โดย venv ยัง activate อยู่) รันทั้ง api + web พร้อมกัน:

```bash
npm run dev
```

| คำสั่ง | ทำอะไร |
| --- | --- |
| `npm run dev` | รัน uvicorn (:3000) + vite (:5173) พร้อมกัน |
| `npm run dev:api` | รันเฉพาะ API |
| `alembic upgrade head` (ใน `backend/`) | สร้าง/อัปเดตตารางใน database |
| `alembic revision --autogenerate -m "..."` | สร้าง migration ใหม่หลังแก้ `app/models.py` |
| `python -m app.seed` | ใส่ข้อมูลตัวอย่าง (`--reset` เพื่อล้างก่อน) |
| `ruff check .` (ใน `backend/`) | lint |

ใช้ **Postgres ตัวเดียวกันทั้ง docker และการรันบนเครื่อง** — ต้องเปิด container `db` ไว้เสมอ:

```bash
docker compose up -d db
```

> **พอร์ต 55432 ไม่ใช่ 5432** เพราะเครื่องนี้มี PostgreSQL ติดตั้งอยู่แล้ว 2 ตัวที่ยึด 5432 กับ 5433 ไว้
> ถ้าย้ายไปเครื่องอื่นที่ว่าง เปลี่ยน `DB_PORT` ใน `.env` กลับเป็น 5432 ได้

> **เลือกทางเดียว** — docker กับ `npm run dev` ใช้พอร์ต 3000 เหมือนกัน ถ้ารันพร้อมกันจะชนกัน
> สั่ง `docker compose stop api` ก่อนถ้าจะรันบนเครื่อง (หรือตั้ง `API_PORT=3300 npm run dev:api`)

## คำสั่งที่ใช้บ่อย

```bash
docker compose logs -f api        # ดู log
docker compose exec api sh        # เข้า shell ใน container
docker compose down               # หยุด (ข้อมูล db ยังอยู่)
docker compose down -v            # หยุด + ลบข้อมูล db
```

## Database

| ตาราง | เก็บอะไร |
| --- | --- |
| `members` | พนักงาน (ชื่อ, ตำแหน่ง, สี avatar) |
| `projects` | โปรเจค |
| `tasks` | งาน (สถานะ, ความสำคัญ, กำหนดส่ง, `position` = ลำดับในคอลัมน์) |
| `project_members` | พนักงานคนไหนอยู่โปรเจคไหน |
| `task_assignees` | งานใบไหนมอบให้ใคร (หนึ่งงานมีได้หลายคน) |

migration อยู่ใน `backend/alembic/versions/` และ **container รัน `alembic upgrade head` ให้อัตโนมัติ**
ทุกครั้งที่ start ไม่ต้องสั่งเอง

ใส่ข้อมูลตัวอย่างครั้งแรก:

```bash
docker compose exec api python -m app.seed
```

### เมื่อแก้ตาราง

1. แก้ `backend/app/models.py`
2. `alembic revision --autogenerate -m "อธิบายสั้น ๆ"`
3. เปิดไฟล์ที่ได้ใน `alembic/versions/` อ่านทวนก่อนใช้ — autogenerate ไม่ได้ถูกเสมอ

## AI แตกงานย่อย (Gemini)

ปุ่ม **แตกงานด้วย AI** บนแถบหัว รับหัวข้องานกว้าง ๆ แล้วให้ Gemini แตกเป็นงานย่อยพร้อม
หมวดหมู่ · tag ทักษะที่ต้องใช้ · เวลาที่ประเมิน · ระดับความยาก

API key อยู่ฝั่ง backend เท่านั้น ไม่หลุดไปที่เบราว์เซอร์:

```
frontend  →  POST /api/ai/breakdown  →  FastAPI  →  Gemini
```

### เปิดใช้งานจริง

1. ขอ key ที่ https://aistudio.google.com/apikey
2. ใส่ใน `.env`:
   ```
   GEMINI_API_KEY=<key ของคุณ>
   AI_MOCK=false
   ```
3. `docker compose up -d --build api`

ระหว่างที่ยังไม่มี key ให้ตั้ง `AI_MOCK=true` จะได้ข้อมูลตัวอย่างไว้ลอง UI
และหน้าจอจะขึ้นแถบเตือนสีส้มว่ากำลังใช้ข้อมูลปลอมอยู่ (พอมี key จริงแล้วระบบจะใช้ Gemini เสมอ
ไม่สนใจค่า `AI_MOCK`)

### เรื่องชื่อโมเดล

Google ปิด `gemini-2.5-flash` สำหรับ key ที่สร้างใหม่แล้ว ตอนนี้ตั้งไว้เป็น **`gemini-3.6-flash`**
ถ้าวันหลังเจอ error `404 ... no longer available to new users` ให้เปลี่ยน `GEMINI_MODEL` ใน `.env`
เป็นชื่อรุ่นที่ error บอกมา แล้ว `docker compose up -d api`

หนึ่งครั้งใช้เวลาราว 15 วินาที ฝั่ง client ตั้ง timeout ไว้ 180 วินาที

### จัดคอลัมน์ตามหมวดหมู่

เมนู **จัดกลุ่ม** บนแถบหัว สลับระหว่างจัดคอลัมน์ตาม *สถานะ* กับตาม *หมวดหมู่*
(Frontend / Backend / Database / ...) ที่ AI เติมให้ — เปลี่ยนหมวดหมู่เองได้จากเมนู `⋯` บนการ์ด

## เข้าสู่ระบบด้วย GitHub

1. สร้าง OAuth App ที่ https://github.com/settings/developers
2. **Authorization callback URL** ใส่ให้ตรงกับ `GITHUB_CALLBACK_URL` เป๊ะ ๆ
   (ค่าเริ่มต้นคือ `http://localhost:8081/api/auth/github/callback`)
3. ใส่ค่าใน `.env` แล้ว `docker compose up -d api`

```
GITHUB_CLIENT_ID=<client id>
GITHUB_CLIENT_SECRET=<client secret>
AUTH_MOCK=false
```

scope ที่ขอคือ `read:user read:org` — อ่านโปรไฟล์กับรายชื่อสมาชิก org ไม่ได้ขอสิทธิ์แตะ repo

### เลือกสายที่ถนัด

GitHub ไม่มีข้อมูลนี้ ต้องเลือกเองจากเมนูบัญชีมุมขวาบน:
**Frontend / Backend / Fullstack / Database / Design / DevOps / Testing**

ตั้งชื่อให้ตรงกับหมวดหมู่ที่ AI ใช้ เพื่อให้จับคู่คนกับงานได้ — เวลากด assign
คนที่ถนัดตรงกับหมวดหมู่ของงานจะ**ขึ้นก่อนและไฮไลต์เป็นสีเขียว**
(`Fullstack` นับว่าตรงทั้งงาน Frontend และ Backend)

เบื้องหลังคือ `PATCH /api/auth/me` ซึ่งแก้ได้เฉพาะข้อมูลของตัวเอง

> บทบาทเก็บใน `members.role` เป็นค่าเดียวทั้งระบบ — ยังไม่ได้แยกตามโปรเจค
> ถ้าอยากให้คนเดียวกันมีบทบาทต่างกันแต่ละโปรเจค ต้องย้ายไปเก็บใน `project_members`

> ระหว่างที่ยังไม่มี OAuth App ให้ตั้ง `AUTH_MOCK=true` จะมีปุ่ม **เข้าสู่ระบบ (ทดสอบ)**
> ที่ล็อกอินเป็นพนักงานคนแรกในฐานข้อมูล ใช้ลอง UI ได้เลย

## ดึงรายชื่อพนักงานจาก GitHub

หน้าต่าง **เพิ่มพนักงาน** มีส่วน *ดึงรายชื่อจาก GitHub* เลือกได้ 2 ทาง

| ทาง | ได้ใคร | ต้องมี |
| --- | --- | --- |
| **จาก repository** | collaborator ทุกคนของ repo — เห็นทันทีที่ถูกเชิญ ไม่ต้องรอ commit | repo ที่คุณมีสิทธิ์ push |
| **จาก organization** | สมาชิกทั้งหมดของ org | GitHub Organization |

```
GET  /api/github/repos                              repo ที่มีสิทธิ์ push
POST /api/github/import-collaborators?repo=owner/x  ดึง collaborator ของ repo
GET  /api/github/orgs                               organization ที่เป็นสมาชิก
POST /api/github/import-members?org=<org>           ดึงสมาชิกของ org
```

**เงื่อนไข**
- ต้องล็อกอินด้วย **GitHub จริง** (ปุ่มทดสอบ `AUTH_MOCK` ใช้ไม่ได้ เพราะไม่มี access token)
- scope ที่ขอคือ `read:user read:org repo` — ตัว `repo` จำเป็นสำหรับอ่าน collaborator
  GitHub ไม่มี scope ที่แคบกว่านี้สำหรับ endpoint นั้น
- **ถ้าเคย login ไว้ก่อนหน้านี้ ต้องออกจากระบบแล้วเข้าใหม่** เพราะ token เก่ายังไม่มีสิทธิ์ `repo`

คนที่ดึงเข้ามาจะเข้าไปอยู่ใน **พนักงานใน workspace** ไม่ได้ใส่เข้าโปรเจคให้อัตโนมัติ —
กด `+ เพิ่ม` เลือกเองว่าใครเข้าโปรเจคไหน และ**สายที่ถนัดตั้งเป็น `Member`** ให้เจ้าตัวมาเลือกเองทีหลัง

> **เรื่องความปลอดภัย:** access token ของ GitHub ถูกเก็บใน `members.github_token` แบบ plaintext
> พอจะขึ้น production ควรเข้ารหัสก่อนบันทึก

## แถบด้านขวา

| แผง | ข้อมูลมาจาก |
| --- | --- |
| Project Context & Stats | คำนวณจากงานในโปรเจคที่เปิดอยู่ |
| GitHub Activity & Webhook Log | `GET /api/github/commits` + `GET /api/github/events` (ถามซ้ำทุก 30 วิ) |
| System & Database Health | `GET /api/system/health` (ถามซ้ำทุก 20 วิ) |
| AI Task Details | เลื่อนออกมาเมื่อคลิกการ์ด แสดงงานย่อย/หมวดหมู่/ทักษะ |

### ต่อ GitHub Activity ให้มีข้อมูลจริง

```
GITHUB_REPO=owner/repo
```

ต้อง `git init` + push โปรเจคขึ้น GitHub ก่อน ไม่งั้นแผงจะขึ้นข้อความว่ายังไม่ได้ตั้งค่า

### Webhook

endpoint คือ `POST /api/github/webhook` ตรวจลายเซ็นด้วย `GITHUB_WEBHOOK_SECRET`
อ่านรหัสงานรูปแบบ `TASK-001` จากข้อความ commit มาแสดงเป็นชิปในแผง

> **บน localhost GitHub ยิงเข้ามาไม่ได้** ต้องมี public URL (ngrok / deploy จริง) ก่อน
> ทดสอบเองได้ด้วยการ POST payload ตัวอย่างเข้า endpoint นี้ตรง ๆ
