"""commit match suggestion

เก็บผลที่ AI เดาว่า commit ตรงกับงานใบไหน ตอนที่ commit ไม่ได้เขียนรหัสงานมา

Revision ID: e7c3a9d51f84
Revises: d4a1b8e6c332
Create Date: 2026-09-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e7c3a9d51f84'
down_revision: Union[str, Sequence[str], None] = 'd4a1b8e6c332'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('webhook_events', sa.Column('suggested_task_id', sa.String(length=36), nullable=True))
    op.add_column('webhook_events', sa.Column('suggest_confidence', sa.String(length=10), nullable=True))
    op.add_column('webhook_events', sa.Column('suggest_reason', sa.Text(), nullable=True))
    # ลบงานทิ้งแล้วข้อเสนอไม่ต้องหายตาม แค่ชี้ไปที่ว่าง ๆ
    op.create_foreign_key(
        'webhook_events_suggested_task_id_fkey', 'webhook_events', 'tasks',
        ['suggested_task_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('webhook_events_suggested_task_id_fkey', 'webhook_events', type_='foreignkey')
    op.drop_column('webhook_events', 'suggest_reason')
    op.drop_column('webhook_events', 'suggest_confidence')
    op.drop_column('webhook_events', 'suggested_task_id')
