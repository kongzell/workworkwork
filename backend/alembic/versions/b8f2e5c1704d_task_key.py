"""task key

รหัสงาน <รหัสย่อของโปรเจค>-<เลข> เช่น KST-001 ไว้ให้ commit อ้างถึงการ์ดได้

ทั้งสองคอลัมน์ต้องเติมข้อมูลเดิมก่อนแล้วค่อยตั้ง NOT NULL
ถ้าตั้ง NOT NULL ตั้งแต่แรก migration จะล้มทันทีเพราะแถวเก่ายังว่าง

Revision ID: b8f2e5c1704d
Revises: a1c7d9e40b21
Create Date: 2026-09-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b8f2e5c1704d'
down_revision: Union[str, Sequence[str], None] = 'a1c7d9e40b21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---------- รหัสย่อของโปรเจค ----------
    op.add_column('projects', sa.Column('task_prefix', sa.String(length=10), nullable=True))

    # ตั้งรหัสย่อจากตัวอักษรตัวแรกของแต่ละคำในชื่อ repo
    #   kongzell/kongzell-s-test -> KST      kongzell/Follow-up -> FU
    # repo ที่ไม่มีตัวอักษรเลย (เช่น "...3") ตกไปใช้ TASK
    op.execute(r"""
        UPDATE projects
        SET task_prefix = COALESCE(
            NULLIF(
                UPPER(
                    (SELECT string_agg(SUBSTRING(word FROM 1 FOR 1), '')
                     FROM regexp_split_to_table(
                         regexp_replace(split_part(github_repo, '/', 2), '[^A-Za-z0-9]+', ' ', 'g'),
                         '\s+'
                     ) AS word
                     WHERE word ~ '^[A-Za-z]')
                ),
                ''
            ),
            'TASK'
        )
        WHERE github_repo IS NOT NULL
    """)
    op.execute("UPDATE projects SET task_prefix = 'TASK' WHERE task_prefix IS NULL")
    op.alter_column('projects', 'task_prefix', nullable=False, server_default='TASK')

    # ---------- เลขงาน ----------
    op.add_column('tasks', sa.Column('number', sa.Integer(), nullable=True))

    # ไล่เลขตามลำดับที่สร้าง แยกนับใหม่ในแต่ละโปรเจค
    op.execute("""
        UPDATE tasks t
        SET number = x.rn
        FROM (
            SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY created_at, id) AS rn
            FROM tasks
        ) AS x
        WHERE t.id = x.id
    """)
    op.alter_column('tasks', 'number', nullable=False)
    op.create_unique_constraint('uq_tasks_project_number', 'tasks', ['project_id', 'number'])


def downgrade() -> None:
    op.drop_constraint('uq_tasks_project_number', 'tasks', type_='unique')
    op.drop_column('tasks', 'number')
    op.drop_column('projects', 'task_prefix')
