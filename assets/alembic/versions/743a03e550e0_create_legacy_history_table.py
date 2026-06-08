"""create legacy_history table

Revision ID: 743a03e550e0
Revises: 997cf9a66f10
Create Date: 2026-06-06 00:13:19.076687+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "743a03e550e0"
down_revision = "997cf9a66f10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "legacy_history",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("legacy_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("method_name", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("otu_id", sa.String(), nullable=False),
        sa.Column("otu_name", sa.String(), nullable=False),
        sa.Column("otu_version", sa.String(), nullable=True),
        sa.Column("reference_id", sa.String(), nullable=False),
        sa.Column("index_id", sa.String(), nullable=True),
        sa.Column("index_version", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("legacy_id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index(
        "ix_legacy_history_otu_id_otu_version",
        "legacy_history",
        ["otu_id", sa.text("otu_version DESC")],
    )
    op.create_index(
        "ix_legacy_history_reference_id",
        "legacy_history",
        ["reference_id"],
    )
    op.create_index(
        "ix_legacy_history_index_id",
        "legacy_history",
        ["index_id"],
    )
    op.create_index(
        "ix_legacy_history_user_id",
        "legacy_history",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_legacy_history_user_id", table_name="legacy_history")
    op.drop_index("ix_legacy_history_index_id", table_name="legacy_history")
    op.drop_index("ix_legacy_history_reference_id", table_name="legacy_history")
    op.drop_index("ix_legacy_history_otu_id_otu_version", table_name="legacy_history")
    op.drop_table("legacy_history")
