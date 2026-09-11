"""project member role

เพิ่ม role ให้สมาชิกโปรเจค — "member" (ค่าเริ่มต้น) หรือ "admin"
admin ทำได้เท่าเจ้าของในหน้าเว็บ ยกเว้นลบโปรเจคกับตั้ง admin คนอื่น
เป็นสิทธิ์ต่อโปรเจค ไม่เกี่ยวกับสิทธิ์บน GitHub

Revision ID: b7d3e9f21a5c
Revises: a9e4c1f70d38
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b7d3e9f21a5c'
down_revision: Union[str, Sequence[str], None] = 'a9e4c1f70d38'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # สมาชิกเดิมทุกคนเป็น member — เจ้าของแต่ละโปรเจคค่อยไปตั้ง admin เอง
    op.add_column(
        'project_members',
        sa.Column('role', sa.String(length=10), nullable=False, server_default='member'),
    )


def downgrade() -> None:
    op.drop_column('project_members', 'role')
