"""task needs rework

จำว่างานถูกตีกลับจาก "รอตรวจ" ให้ไปแก้ ใช้ทำให้การ์ดขึ้นสีเตือน

Revision ID: c5b8f2a91e07
Revises: e7c3a9d51f84
Create Date: 2026-09-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c5b8f2a91e07'
down_revision: Union[str, Sequence[str], None] = 'e7c3a9d51f84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # งานเก่ายังไม่เคยถูกตีกลับ ตั้งเป็น false ทั้งหมด
    op.add_column(
        'tasks',
        sa.Column('needs_rework', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('tasks', 'needs_rework')
