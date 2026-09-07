"""เรียก Gemini ให้แตกงานใหญ่เป็นงานย่อย พร้อมจัดหมวดหมู่ / tag / ประเมินเวลา

เรียกผ่าน REST ตรง ๆ ไม่ผ่าน SDK เพื่อไม่ต้องตามเวอร์ชัน SDK
และใช้ structured output (responseSchema) เพื่อให้ได้ JSON ที่ parse ได้แน่นอน
ไม่ต้องมานั่งแกะ markdown code fence
"""

import json

import httpx
from fastapi import HTTPException

from app.config import get_settings
from app.schemas import BreakdownResult, SubtaskSuggestion

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

CATEGORIES = ["Frontend", "Backend", "Database", "Design", "DevOps", "Testing", "Other"]
COMPLEXITIES = ["low", "medium", "high"]

# บังคับรูปแบบผลลัพธ์ ไม่ให้โมเดลตอบเป็นข้อความอิสระ
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "subtasks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "category": {"type": "string", "enum": CATEGORIES},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "estimateHours": {"type": "number"},
                    "complexity": {"type": "string", "enum": COMPLEXITIES},
                    "reason": {"type": "string"},
                },
                "required": ["title", "category", "tags", "estimateHours", "complexity"],
            },
        },
    },
    "required": ["summary", "subtasks"],
}

PROMPT = """คุณคือ tech lead ที่ช่วยแตกงานให้ทีมพัฒนาซอฟต์แวร์

งานที่ได้รับมา: "{title}"
{context}

แตกงานนี้เป็นงานย่อยที่ลงมือทำได้จริงและเช็คลิสต์ได้ ตามกติกานี้:

1. งานย่อยแต่ละข้อต้องเป็นสิ่งที่ "ทำแล้วรู้ว่าเสร็จ" เช่น "สร้างปุ่ม Add to Cart",
   "เขียน API ตัดสต็อก", "ออกแบบตารางข้อมูลสินค้า" — ห้ามเป็นงานกว้าง ๆ อย่าง "ทำ frontend"
2. ตั้งชื่องานย่อยเป็นภาษาไทย แต่คำเทคนิค ชื่อ library ชื่อ endpoint ให้คงเป็นภาษาอังกฤษ
3. category เลือกจาก: {categories}
4. tags คือทักษะ/เครื่องมือ/ภาษาที่ต้องใช้จริงกับงานย่อยนั้น เช่น React, TypeScript, PostgreSQL,
   REST API — ใส่ 1-4 อัน ห้ามใส่คำกว้างอย่าง "coding" หรือ "programming"
5. estimateHours คือชั่วโมงที่นักพัฒนาระดับกลางน่าจะใช้ ให้เป็นตัวเลขที่สมจริง (0.5-16)
6. complexity: low = ตรงไปตรงมา, medium = ต้องคิดออกแบบบ้าง, high = มีความเสี่ยง/ของใหม่/กระทบหลายส่วน
7. reason อธิบายสั้น ๆ ว่าทำไมถึงประเมินความยากระดับนั้น (ไม่เกิน 1 บรรทัด)
8. แตกประมาณ {count} งานย่อย แต่ปรับจำนวนได้ตามความเหมาะสมของงาน (อย่างน้อย 3)
   งานเล็กไม่ต้องยัดให้ครบ งานใหญ่แตกเพิ่มได้ เรียงตามลำดับที่ควรลงมือทำก่อนหลัง

summary คือสรุปหนึ่งประโยคว่างานนี้โดยรวมคืออะไร"""

MOCK = BreakdownResult(
    summary="[ตัวอย่าง] ระบบตะกร้าสินค้าฝั่งหน้าร้านและหลังบ้าน",
    mock=True,
    subtasks=[
        SubtaskSuggestion(
            title="ออกแบบตารางข้อมูล cart และ cart_items",
            category="Database", tags=["PostgreSQL", "SQLAlchemy"],
            estimate_hours=2, complexity="medium",
            reason="ต้องคิดเรื่องความสัมพันธ์กับตารางสินค้าให้จบตั้งแต่แรก",
        ),
        SubtaskSuggestion(
            title="เขียน API เพิ่มสินค้าลงตะกร้า",
            category="Backend", tags=["FastAPI", "REST API"],
            estimate_hours=3, complexity="medium",
            reason="ต้องกันกรณีสินค้าซ้ำและสต็อกไม่พอ",
        ),
        SubtaskSuggestion(
            title="สร้างปุ่ม Add to Cart",
            category="Frontend", tags=["React", "TypeScript"],
            estimate_hours=1.5, complexity="low",
            reason="เป็นงาน UI ตรงไปตรงมา",
        ),
        SubtaskSuggestion(
            title="เขียน API ตัดสต็อกตอนยืนยันคำสั่งซื้อ",
            category="Backend", tags=["FastAPI", "Transaction"],
            estimate_hours=4, complexity="high",
            reason="ต้องกันสต็อกติดลบเมื่อมีคนสั่งพร้อมกัน",
        ),
    ],
)


async def breakdown(title: str, context: str = "", count: int = 5) -> BreakdownResult:
    settings = get_settings()

    if settings.ai_mock and not settings.gemini_api_key:
        return MOCK.model_copy(update={"summary": f"[ตัวอย่าง] {title}"})

    if not settings.gemini_api_key:
        raise HTTPException(
            503,
            "ยังไม่ได้ตั้ง GEMINI_API_KEY — ขอ key ที่ https://aistudio.google.com/apikey "
            "แล้วใส่ในไฟล์ .env (หรือตั้ง AI_MOCK=true เพื่อลอง UI ด้วยข้อมูลตัวอย่างก่อน)",
        )

    prompt = PROMPT.format(
        title=title,
        context=f"ข้อมูลเพิ่มเติมจากผู้ใช้: {context}" if context.strip() else "",
        categories=", ".join(CATEGORIES),
        count=count,
    )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            "temperature": 0.4,
        },
    }

    url = ENDPOINT.format(model=settings.gemini_model)
    try:
        # โมเดลรุ่นใหม่ใช้เวลาคิดนานกว่าเดิม เผื่อเวลาไว้เยอะหน่อย
        async with httpx.AsyncClient(timeout=180) as client:
            res = await client.post(
                url, json=payload, headers={"x-goog-api-key": settings.gemini_api_key}
            )
    except httpx.HTTPError as exc:
        # ข้อความของ timeout เป็นสตริงว่าง ต้องเอาชื่อคลาสมาบอกด้วยถึงจะรู้เรื่อง
        raise HTTPException(502, f"ต่อ Gemini ไม่ได้ ({type(exc).__name__}): {exc}") from exc

    if res.status_code != 200:
        detail = res.text[:300]
        raise HTTPException(502, f"Gemini ตอบกลับ {res.status_code}: {detail}")

    try:
        text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text)
    except (KeyError, IndexError, ValueError) as exc:
        raise HTTPException(502, f"อ่านคำตอบจาก Gemini ไม่ได้: {exc}") from exc

    return BreakdownResult.model_validate({**data, "mock": False})


# ---------- จับคู่ commit กับการ์ด ----------
#
# ใช้ตอนที่ commit ไม่ได้เขียนรหัสงานมา (ซึ่งเกิดบ่อยกว่าที่คิด)
# ผลลัพธ์เป็นแค่ "ข้อเสนอ" ไม่ย้ายการ์ดเอง เพราะเดาผิดแล้วงานของคนอื่นขยับ
# จะสร้างความสับสนมากกว่าประโยชน์ที่ได้

#: 0 = ไม่ตรงกับงานไหนเลย — ใช้แทน null เพราะ responseSchema ไม่รองรับ nullable
MATCH_SCHEMA = {
    "type": "object",
    "properties": {
        "number": {"type": "integer"},
        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
        "reason": {"type": "string"},
    },
    "required": ["number", "confidence", "reason"],
}

MATCH_PROMPT = """คุณคือ tech lead ที่กำลังดูว่า commit ที่เพิ่งเข้ามาตรงกับงานใบไหนในบอร์ด

ข้อความ commit: "{message}"

รายการงานที่ยังไม่เสร็จในโปรเจคนี้:
{tasks}

ตอบว่า commit นี้น่าจะเป็นงานใบไหน ตามกติกา:

1. number = เลขงานที่ตรงที่สุด ถ้าไม่มีใบไหนตรงเลยให้ตอบ 0
2. ห้ามเดาสุ่ม — ถ้าข้อความ commit กว้างเกินไป เช่น "fix bug", "update", "แก้โค้ด"
   หรือไม่เกี่ยวกับงานใบไหนเลย ให้ตอบ 0
3. confidence:
   high   = ข้อความพูดถึงสิ่งเดียวกับชื่องานชัดเจน
   medium = เกี่ยวข้องกันแต่ไม่ได้ตรงคำต่อคำ
   low    = พอเดาได้แต่ไม่มั่นใจ
4. reason อธิบายสั้น ๆ ไม่เกิน 1 บรรทัด ว่าทำไมถึงเลือกใบนั้น (หรือทำไมถึงไม่ตรงกับใบไหน)
   ตอบเป็นภาษาไทย"""


async def match_commit(message: str, tasks: list[dict]) -> dict | None:
    """เดาว่า commit ตรงกับงานใบไหน — คืน None เมื่อไม่มั่นใจหรือเรียกไม่สำเร็จ

    tasks: [{"number": 3, "title": "...", "category": "Backend"}, ...]

    ตั้งใจไม่ให้ error ออกไปข้างนอก เพราะฟังก์ชันนี้ถูกเรียกหลังตอบ webhook ไปแล้ว
    ถ้า Gemini ล่มก็แค่ไม่มีข้อเสนอ ไม่ควรทำให้อะไรพัง
    """
    settings = get_settings()
    if not settings.gemini_api_key or not tasks:
        return None

    listing = "\n".join(
        f"- เลข {t['number']}: {t['title']}"
        + (f"  [{t['category']}]" if t.get("category") else "")
        for t in tasks
    )
    payload = {
        "contents": [{"parts": [{"text": MATCH_PROMPT.format(message=message, tasks=listing)}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": MATCH_SCHEMA,
            # งานนี้ต้องการความแม่น ไม่ต้องการความสร้างสรรค์
            "temperature": 0.1,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(
                ENDPOINT.format(model=settings.gemini_model),
                json=payload,
                headers={"x-goog-api-key": settings.gemini_api_key},
            )
        if res.status_code != 200:
            return None
        data = json.loads(res.json()["candidates"][0]["content"]["parts"][0]["text"])
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        return None

    number = data.get("number") or 0
    if number <= 0 or not any(t["number"] == number for t in tasks):
        return None
    return {
        "number": number,
        "confidence": data.get("confidence") or "low",
        "reason": (data.get("reason") or "")[:300],
    }
