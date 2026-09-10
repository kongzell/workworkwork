"""task description and comments

- tasks.description  รายละเอียดงานที่เจ้าของเขียนไว้
- task_comments      บันทึกของคนที่รับงาน ว่าติดอะไร จะแก้ยังไง

Revision ID: a9e4c1f70d38
Revises: f3a2c9d7b481
Create Date: 2026-09-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a9e4c1f70d38'
down_revision: Union[str, Sequence[str], None] = 'f3a2c9d7b481'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('description', sa.Text(), nullable=True))

    op.create_table(
        'task_comments',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('task_id', sa.String(length=36), nullable=False),
        # คนเขียนถูกลบออกจากระบบแล้วคอมเมนต์ยังอยู่ ไม่งั้นบทสนทนาจะขาดหาย
        sa.Column('member_id', sa.String(length=36), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['member_id'], ['members.id'], ondelete='SET NULL'),
    )
    # อ่านคอมเมนต์ทีละการ์ดเสมอ เรียงตามเวลา
    op.create_index(
        'ix_task_comments_task_created', 'task_comments', ['task_id', 'created_at']
    )


def downgrade() -> None:
    op.drop_index('ix_task_comments_task_created', table_name='task_comments')
    op.drop_table('task_comments')
    op.drop_column('tasks', 'description')
