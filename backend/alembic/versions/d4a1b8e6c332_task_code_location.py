"""task code location

เก็บ branch และลิงก์ PR ไว้ที่งาน เพื่อกดจากการ์ดไปดูโค้ดตอนตรวจงานได้

Revision ID: d4a1b8e6c332
Revises: b8f2e5c1704d
Create Date: 2026-09-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd4a1b8e6c332'
down_revision: Union[str, Sequence[str], None] = 'b8f2e5c1704d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # งานเก่าไม่มีข้อมูลนี้ ปล่อยว่างได้ ลิงก์จะโผล่เมื่อมี push/PR อ้างถึงครั้งแรก
    op.add_column('tasks', sa.Column('branch', sa.String(length=255), nullable=True))
    op.add_column('tasks', sa.Column('review_url', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'review_url')
    op.drop_column('tasks', 'branch')
