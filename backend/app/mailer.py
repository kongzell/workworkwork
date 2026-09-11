"""แจ้งเตือนทางอีเมลผ่าน Brevo (HTTPS API)

ทำไมไม่ใช้ SMTP: Render บล็อกพอร์ต 587 ขาออก ทดสอบแล้วได้ OSError ทุกครั้ง
ทั้งที่รหัสเดียวกันส่งได้บนเครื่อง — ส่วน 443 ไม่โดนบล็อกเพราะเว็บทั้งเว็บวิ่งผ่านมัน

หลักที่ยึดไว้ 3 ข้อ

1. อีเมลส่งไม่ออก ห้ามทำให้คำขอที่ผู้ใช้กดพัง — งานถูกสร้างแล้วก็ต้องถือว่าสำเร็จ
   ต่อให้แจ้งเตือนไม่ถึงใครเลย จึงห่อด้วย try/except และเรียกผ่าน BackgroundTasks
2. ยังไม่ได้ตั้งค่า = ปิดแจ้งเตือนเงียบ ๆ ไม่ใช่ error
   ตอน dev ไม่มีใครอยากสมัคร Brevo แค่เพื่อลากการ์ด
3. ห้าม log API key ไม่ว่ากรณีใด
"""

from __future__ import annotations

import logging

import httpx

from app.config import get_settings

log = logging.getLogger("mailer")

ENDPOINT = "https://api.brevo.com/v3/smtp/email"

#: กันค้างนานตอน Brevo ช้า — ทำงานอยู่หลัง response แล้ว ผู้ใช้ไม่ได้รอ
TIMEOUT = 15


def _why(exc: Exception) -> str:
    """บอกสาเหตุเท่าที่ปลอดภัย — ห้ามให้ API key หลุดลง log"""
    name = type(exc).__name__
    if isinstance(exc, OSError) and exc.errno is not None:
        return f"{name} errno={exc.errno} {exc.strerror or ''}".strip()
    return name


async def send(recipients: list[str], subject: str, body: str) -> None:
    """ส่งให้ทีละคน — ไม่รวมใน to เดียวกันเพราะผู้รับจะเห็นอีเมลของกันและกัน

    ถูกเรียกผ่าน BackgroundTasks เสมอ (FastAPI รอรับทั้งฟังก์ชัน sync และ async)
    """
    settings = get_settings()
    targets = sorted({r.strip() for r in recipients if r and r.strip()})

    if not settings.mail_ready:
        log.info("ข้ามการแจ้งเตือน %d คน — ยังไม่ได้ตั้ง BREVO_API_KEY/MAIL_FROM", len(targets))
        return
    if not targets:
        return

    headers = {
        "api-key": settings.brevo_api_key,
        "content-type": "application/json",
        "accept": "application/json",
    }
    sender = {"name": settings.mail_from_name, "email": settings.mail_from}

    sent = 0
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for to in targets:
            payload = {
                "sender": sender,
                "to": [{"email": to}],
                "subject": subject,
                "textContent": body,
            }
            try:
                res = await client.post(ENDPOINT, headers=headers, json=payload)
            except Exception as exc:  # noqa: BLE001 — ล้มก็แค่ไม่มีอีเมล ห้ามลามไปที่คำขอ
                log.warning("ส่งอีเมลไม่สำเร็จ (%s): %s", to, _why(exc))
                continue

            if res.status_code >= 400:
                # ข้อความจาก Brevo บอกสาเหตุตรง ๆ เช่นอีเมลผู้ส่งยังไม่ได้ยืนยัน
                # ไม่มี API key อยู่ในนั้น จึง log ได้
                log.warning(
                    "ส่งอีเมลไม่สำเร็จ (%s): Brevo ตอบ %s %s",
                    to, res.status_code, res.text[:160],
                )
                continue

            sent += 1

    log.info("ส่งแจ้งเตือนสำเร็จ %d จาก %d", sent, len(targets))
