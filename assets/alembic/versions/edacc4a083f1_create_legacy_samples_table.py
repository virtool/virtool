"""create legacy_samples table

Revision ID: edacc4a083f1
Revises: ed265b939a84
Create Date: 2026-06-30 20:08:49.120626+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "edacc4a083f1"
down_revision = "ed265b939a84"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "legacy_samples",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("legacy_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("host", sa.String(), nullable=False),
        sa.Column("isolate", sa.String(), nullable=False),
        sa.Column("locale", sa.String(), nullable=False),
        sa.Column("notes", sa.String(), nullable=False),
        sa.Column("library_type", sa.String(), nullable=False),
        sa.Column("format", sa.String(), nullable=False),
        sa.Column("group", sa.String(), nullable=True),
        sa.Column("quality", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("paired", sa.Boolean(), nullable=False),
        sa.Column("ready", sa.Boolean(), nullable=False),
        sa.Column("hold", sa.Boolean(), nullable=False),
        sa.Column("is_legacy", sa.Boolean(), nullable=False),
        sa.Column("all_read", sa.Boolean(), nullable=False),
        sa.Column("all_write", sa.Boolean(), nullable=False),
        sa.Column("group_read", sa.Boolean(), nullable=False),
        sa.Column("group_write", sa.Boolean(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("job_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("legacy_id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
    )
    op.create_index(
        "ix_legacy_samples_user_id_created_at",
        "legacy_samples",
        ["user_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "ix_legacy_samples_all_read",
        "legacy_samples",
        ["all_read"],
        postgresql_where=sa.text("all_read = true"),
    )
    op.create_index(
        "ix_legacy_samples_group_read",
        "legacy_samples",
        ["group_read"],
        postgresql_where=sa.text("group_read = true"),
    )
    op.create_index("ix_legacy_samples_group", "legacy_samples", ["group"])

    op.create_table(
        "legacy_sample_labels",
        sa.Column("sample_id", sa.BigInteger(), nullable=False),
        sa.Column("label_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("sample_id", "label_id"),
        sa.ForeignKeyConstraint(["sample_id"], ["legacy_samples.id"]),
        sa.ForeignKeyConstraint(["label_id"], ["labels.id"]),
    )

    op.create_table(
        "legacy_sample_subtractions",
        sa.Column("sample_id", sa.BigInteger(), nullable=False),
        sa.Column("subtraction_id", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("sample_id", "subtraction_id"),
        sa.ForeignKeyConstraint(["sample_id"], ["legacy_samples.id"]),
        sa.ForeignKeyConstraint(["subtraction_id"], ["subtractions.id"]),
    )


def downgrade() -> None:
    op.drop_table("legacy_sample_subtractions")
    op.drop_table("legacy_sample_labels")
    op.drop_index("ix_legacy_samples_group", table_name="legacy_samples")
    op.drop_index("ix_legacy_samples_group_read", table_name="legacy_samples")
    op.drop_index("ix_legacy_samples_all_read", table_name="legacy_samples")
    op.drop_index("ix_legacy_samples_user_id_created_at", table_name="legacy_samples")
    op.drop_table("legacy_samples")
