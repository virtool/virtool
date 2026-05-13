"""create caches table

Revision ID: c3a7e9b4d1f2
Revises: bd1ffbecfce5
Create Date: 2026-05-06 00:00:00.000000+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "c3a7e9b4d1f2"
down_revision = "bd1ffbecfce5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "caches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("params", JSONB(), nullable=False),
        sa.Column("parent_id", sa.String(), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_accessed_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="cache_key"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index(
        op.f("ix_caches_parent_id"),
        "caches",
        ["parent_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_caches_parent_id"), table_name="caches")
    op.drop_table("caches")
