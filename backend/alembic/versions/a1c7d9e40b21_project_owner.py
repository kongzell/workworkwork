"""project owner

เพิ่มเจ้าของโปรเจค แล้วเติมข้อมูลย้อนหลังให้โปรเจคที่มีอยู่แล้ว
ไม่งั้นพอเริ่มกรองตามสมาชิก โปรเจคเก่าจะกลายเป็นของไม่มีใครและหายไปจากทุกหน้าจอ

Revision ID: a1c7d9e40b21
Revises: f3253475ad9d
Create Date: 2026-09-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1c7d9e40b21'
down_revision: Union[str, Sequence[str], None] = 'f3253475ad9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('owner_id', sa.String(length=36), nullable=True))
    op.create_foreign_key(
        'projects_owner_id_fkey', 'projects', 'members',
        ['owner_id'], ['id'], ondelete='SET NULL',
    )

    # โปรเจคเดิมยังไม่มีเจ้าของ — ยกให้พนักงานคนแรกที่ผูกกับ GitHub
    # (คนที่ล็อกอินสร้างข้อมูลพวกนี้ไว้) ถ้าไม่มีเลยก็ใช้คนแรกสุดในระบบ
    op.execute("""
        UPDATE projects
        SET owner_id = COALESCE(
            (SELECT id FROM members WHERE github_id IS NOT NULL ORDER BY created_at LIMIT 1),
            (SELECT id FROM members ORDER BY created_at LIMIT 1)
        )
        WHERE owner_id IS NULL
    """)

    # เจ้าของต้องเป็นสมาชิกของโปรเจคตัวเองด้วย ไม่งั้นมองไม่เห็นโปรเจคตัวเอง
    op.execute("""
        INSERT INTO project_members (project_id, member_id)
        SELECT p.id, p.owner_id
        FROM projects p
        WHERE p.owner_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM project_members pm
              WHERE pm.project_id = p.id AND pm.member_id = p.owner_id
          )
    """)


def downgrade() -> None:
    op.drop_constraint('projects_owner_id_fkey', 'projects', type_='foreignkey')
    op.drop_column('projects', 'owner_id')
