"""task history for member dashboard

เก็บสองอย่างที่แดชบอร์ดประเมินผลงานต้องใช้ แต่ตารางเดิมไม่ได้บันทึกไว้
- rework_count  ถูกตีกลับมาแก้กี่ครั้ง (needs_rework เป็นสถานะปัจจุบัน ประวัติหาย)
- completed_at  ปิดงานเมื่อไหร่ (updated_at ขยับทุกครั้งที่แก้การ์ด ใช้แทนไม่ได้)

Revision ID: f3a2c9d7b481
Revises: c5b8f2a91e07
Create Date: 2026-09-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f3a2c9d7b481'
down_revision: Union[str, Sequence[str], None] = 'c5b8f2a91e07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tasks',
        sa.Column('rework_count', sa.Integer(), nullable=False, server_default='0'),
    )
    op.add_column(
        'tasks',
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )

    # งานที่ปิดไปก่อนมีคอลัมน์นี้ ประมาณวันปิดจาก updated_at
    # ไม่แม่นถ้ามีคนแก้การ์ดหลังปิดงาน แต่ดีกว่าปล่อยว่างจนงานเก่าหายจากแดชบอร์ด
    op.execute(
        "UPDATE tasks SET completed_at = updated_at WHERE status = 'complete'"
    )


def downgrade() -> None:
    op.drop_column('tasks', 'completed_at')
    op.drop_column('tasks', 'rework_count')
