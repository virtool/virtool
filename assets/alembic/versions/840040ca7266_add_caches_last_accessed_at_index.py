"""add caches last_accessed_at index

Revision ID: 840040ca7266
Revises: d28bebf9934b
Create Date: 2026-05-27 20:24:22.698090+00:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "840040ca7266"
down_revision = "d28bebf9934b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_caches_last_accessed_at_id",
        "caches",
        ["last_accessed_at", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_caches_last_accessed_at_id", table_name="caches")
