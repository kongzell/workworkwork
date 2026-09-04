"""เข้ารหัส access token ของ GitHub ก่อนเก็บลงฐานข้อมูล

token ของ GitHub เปิด repo ของผู้ใช้ได้ทั้งหมด ถ้าฐานข้อมูลรั่วแล้วเก็บเป็น
ข้อความธรรมดา คนที่ได้ไฟล์ไปใช้ต่อได้ทันที การเข้ารหัสทำให้ต้องได้ทั้ง
ฐานข้อมูลและ TOKEN_SECRET (ซึ่งอยู่ใน environment คนละที่) ถึงจะใช้ได้

แถวเก่าที่เก็บเป็น plaintext ไว้ก่อนหน้ายังอ่านได้ปกติ — ถอดรหัสจะคืนค่าเดิม
ให้ แล้วจะถูกเขียนทับเป็นแบบเข้ารหัสเองตอนผู้ใช้ล็อกอินรอบถัดไป
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

#: นำหน้าค่าที่เข้ารหัสแล้ว ใช้แยกจากแถวเก่าที่เป็น plaintext
PREFIX = "enc:"


def _fernet() -> Fernet:
    """คีย์มาจาก TOKEN_SECRET — ถ้าไม่ได้ตั้งจะยืม SESSION_SECRET มาใช้แทน

    Fernet ต้องการคีย์ 32 ไบต์ในรูป urlsafe base64 จึงย่อ secret ด้วย SHA-256 ก่อน
    """
    settings = get_settings()
    secret = settings.token_secret or settings.session_secret
    digest = hashlib.sha256(secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(plain: str | None) -> str | None:
    if not plain:
        return plain
    return PREFIX + _fernet().encrypt(plain.encode()).decode()


def decrypt(stored: str | None) -> str | None:
    if not stored:
        return stored
    if not stored.startswith(PREFIX):
        # แถวเก่าที่ยังเป็น plaintext — คืนไปตรง ๆ ไม่ให้ระบบพัง
        return stored
    try:
        return _fernet().decrypt(stored[len(PREFIX):].encode()).decode()
    except InvalidToken:
        # secret ถูกเปลี่ยนหลังจากเข้ารหัสไปแล้ว ถอดไม่ออก
        # ให้ถือว่าไม่มี token ผู้ใช้จะถูกขอให้ล็อกอินใหม่แทนที่จะเจอ error
        return None
