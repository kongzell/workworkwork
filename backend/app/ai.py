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
                    "description": {"type": "string"},
                    "category": {"type": "string", "enum": CATEGORIES},
                    "tags": {"type": "array", "items": {"type": "string"}},
                    "estimateHours": {"type": "number"},
                    "complexity": {"type": "string", "enum": COMPLEXITIES},
                    "reason": {"type": "string"},
                },
                "required": [
                    "title", "description", "category", "tags", "estimateHours", "complexity",
                ],
            },
        },
    },
    "required": ["summary", "subtasks"],
}

PROMPT = """You are a tech lead breaking work down for a software team.

The request: "{title}"
{context}

Break it into subtasks that can actually be picked up and checked off:

1. Every subtask must be something you can tell is finished, e.g. "Build the Add to Cart button",
   "Write the stock deduction API", "Design the products table" — never something broad
   like "do the frontend"
2. Answer in the SAME LANGUAGE as the request above — Thai request, Thai answer;
   English request, English answer. This applies to summary, title, description and reason.
   Keep technical terms in English either way: library names, endpoints, table and field
   names, HTTP verbs. Write "เขียน endpoint POST /api/carts", never a translated path
2b. description is 2-4 sentences: what has to be built, and what counts as done.
   Be concrete — name the fields, endpoints, states or edge cases involved.
   Do not repeat the title, and do not restate the complexity reason
3. category must be one of: {categories} — these stay in English, they are fixed values
4. tags are the skills/tools/languages the subtask actually needs, e.g. React, TypeScript,
   PostgreSQL, REST API — give 1-4, always in English, never vague words like "coding"
5. estimateHours is what a mid-level developer would realistically spend (0.5-16)
6. complexity: low = straightforward, medium = needs some design thinking,
   high = risky, unfamiliar, or touching many parts
7. reason explains in one line why you rated the complexity that way
8. Aim for about {count} subtasks, but adjust to fit the work (at least 3).
   Do not pad a small job; split a large one further. Order them the way they should be done.

summary is one sentence saying what the whole request is."""

MOCK = BreakdownResult(
    summary="[sample] Shopping cart, storefront and back office",
    mock=True,
    subtasks=[
        SubtaskSuggestion(
            title="Design the cart and cart_items tables",
            description=(
                "One cart row per user, one cart_items row per product in it.\n"
                "Keep unit price on cart_items so old carts do not change when a "
                "product is repriced.\n"
                "Done when a cart survives logout and login."
            ),
            category="Database", tags=["PostgreSQL", "SQLAlchemy"],
            estimate_hours=2, complexity="medium",
            reason="The relationship to the products table has to be settled up front",
        ),
        SubtaskSuggestion(
            title="Write the add-to-cart API",
            description=(
                "POST that takes a product id and a quantity.\n"
                "Adding a product already in the cart raises the quantity instead of "
                "creating a second row.\n"
                "Reject quantities above the stock on hand with a 400."
            ),
            category="Backend", tags=["FastAPI", "REST API"],
            estimate_hours=3, complexity="medium",
            reason="Has to handle duplicate items and insufficient stock",
        ),
        SubtaskSuggestion(
            title="Build the Add to Cart button",
            description=(
                "Button on the product card that calls the add-to-cart API.\n"
                "Disable it while the request is running so a double click cannot "
                "add twice.\n"
                "Update the cart badge in the header on success."
            ),
            category="Frontend", tags=["React", "TypeScript"],
            estimate_hours=1.5, complexity="low",
            reason="Straightforward UI work",
        ),
        SubtaskSuggestion(
            title="Write the stock deduction API for order confirmation",
            description=(
                "On confirm, deduct every item in the cart from stock inside one "
                "transaction.\n"
                "If any item is short, roll back the whole order and say which one.\n"
                "Done when two people confirming the last item at the same time "
                "leaves stock at zero, never negative."
            ),
            category="Backend", tags=["FastAPI", "Transaction"],
            estimate_hours=4, complexity="high",
            reason="Must not let stock go negative under concurrent orders",
        ),
    ],
)


def _explain(status: int, body: str) -> str:
    """แปลง error ของ Gemini เป็นข้อความที่คนอ่านรู้เรื่อง

    ของเดิมโยน JSON ดิบขึ้นหน้าเว็บทั้งก้อน ซึ่งยาว อ่านไม่ออก และมักถูกตัดกลางประโยค
    ผู้ใช้ต้องรู้แค่ว่า "เกิดอะไร" กับ "ทำยังไงต่อ"
    """
    if status == 429:
        return "โควตา Gemini หมดแล้ว"
    if status == 503:
        return "ตอนนี้ Gemini มีคนใช้เยอะ ลองกดใหม่อีกครั้งใน 1-2 นาที"
    if status in (401, 403):
        return "GEMINI_API_KEY ใช้ไม่ได้หรือหมดอายุ — ขอ key ใหม่ที่ https://aistudio.google.com/apikey"
    if status == 400:
        return f"Gemini ไม่รับคำขอนี้ (400) — {_first_message(body)}"
    return f"Gemini ตอบกลับ {status} — {_first_message(body)}"


def _first_message(body: str) -> str:
    """ดึงเฉพาะบรรทัด message จาก JSON ที่ Gemini ส่งมา ไม่เอาทั้งก้อน"""
    try:
        text = json.loads(body).get("error", {}).get("message", "")
    except (ValueError, AttributeError):
        text = body
    text = " ".join(text.split())
    return text[:160] if text else "ไม่มีรายละเอียดเพิ่มเติม"


async def breakdown(title: str, context: str = "", count: int = 5) -> BreakdownResult:
    settings = get_settings()

    if settings.ai_mock and not settings.gemini_api_key:
        return MOCK.model_copy(update={"summary": f"[sample] {title}"})

    if not settings.gemini_api_key:
        raise HTTPException(
            503,
            "GEMINI_API_KEY is not set — get a key at https://aistudio.google.com/apikey "
            "and put it in .env (or set AI_MOCK=true to try the UI with sample data first)",
        )

    prompt = PROMPT.format(
        title=title,
        context=f"Extra context from the user: {context}" if context.strip() else "",
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
        raise HTTPException(502, f"Could not reach Gemini ({type(exc).__name__}): {exc}") from exc

    if res.status_code != 200:
        raise HTTPException(502, _explain(res.status_code, res.text))

    try:
        text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text)
    except (KeyError, IndexError, ValueError) as exc:
        raise HTTPException(502, f"Could not read the Gemini response: {exc}") from exc

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

MATCH_PROMPT = """You are a tech lead deciding which card on the board a new commit belongs to.

Commit message: "{message}"

Unfinished tasks in this project:
{tasks}

Say which task this commit most likely refers to:

1. number = the task number that fits best. Answer 0 if none of them fit
2. Never guess — if the commit message is too broad, e.g. "fix bug", "update", "wip",
   or has nothing to do with any task, answer 0
3. confidence:
   high   = the message clearly talks about the same thing as the task title
   medium = related, but not word for word
   low    = plausible, but you are not sure
4. reason explains your choice in one line (or why nothing matched). Answer in English."""


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
        f"- number {t['number']}: {t['title']}"
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
