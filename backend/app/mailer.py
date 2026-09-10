"""แจ้งเตือนทางอีเมลผ่าน Gmail SMTP

หลักที่ยึดไว้ 3 ข้อ

1. อีเมลส่งไม่ออก ห้ามทำให้คำขอที่ผู้ใช้กดพัง — งานถูกสร้างแล้วก็ต้องถือว่าสำเร็จ
   ต่อให้แจ้งเตือนไม่ถึงใครเลย ทุกอย่างจึงห่อด้วย try/except และเรียกผ่าน BackgroundTasks
2. ยังไม่ได้ตั้ง SMTP_USER/SMTP_PASSWORD = ปิดแจ้งเตือนเงียบ ๆ ไม่ใช่ error
   ตอน dev ไม่มีใครอยากตั้ง App Password แค่เพื่อลากการ์ด
3. ห้าม log รหัสผ่าน ไม่ว่ากรณีใด
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from app.config import get_settings

log = logging.getLogger("mailer")

#: กันอีเมลค้างนาน — smtplib เป็น blocking call ที่รันอยู่ใน threadpool
TIMEOUT = 15


def _send_one(to: str, subject: str, body: str) -> None:
    settings = get_settings()

    msg = EmailMessage()
    # Gmail บังคับว่าที่อยู่ผู้ส่งต้องเป็นบัญชีที่ล็อกอิน เปลี่ยนได้แค่ชื่อที่แสดง
    msg["From"] = formataddr((settings.mail_from_name, settings.smtp_user))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=TIMEOUT) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


def send(recipients: list[str], subject: str, body: str) -> None:
    """ส่งให้ทีละคน — ไม่ใส่รวมใน To เดียวกันเพราะจะเห็นอีเมลกันหมด

    ถูกเรียกผ่าน BackgroundTasks เสมอ (FastAPI รันฟังก์ชันแบบ sync ใน threadpool ให้)
    """
    settings = get_settings()
    targets = sorted({r.strip() for r in recipients if r and r.strip()})

    if not settings.mail_ready:
        log.info("ข้ามการแจ้งเตือน %d คน — ยังไม่ได้ตั้ง SMTP_USER/SMTP_PASSWORD", len(targets))
        return
    if not targets:
        return

    sent = 0
    for to in targets:
        try:
            _send_one(to, subject, body)
            sent += 1
        except Exception as exc:  # noqa: BLE001 — ล้มก็แค่ไม่มีอีเมล ห้ามลามไปที่คำขอ
            # ตั้งใจไม่ log ตัว exception ดิบทั้งก้อน เผื่อ SMTP แนบข้อมูลล็อกอินมาในข้อความ
            log.warning("ส่งอีเมลไม่สำเร็จ (%s): %s", to, type(exc).__name__)

    log.info("ส่งแจ้งเตือนสำเร็จ %d จาก %d", sent, len(targets))
