"""create references table

Revision ID: a73a2668403f
Revises: a329dfd5ba23
Create Date: 2026-07-03 16:05:34.006391+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "a73a2668403f"
down_revision = "a329dfd5ba23"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "legacy_references",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), nullable=False),
        sa.Column("legacy_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("organism", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("restrict_source_types", sa.Boolean(), nullable=False),
        sa.Column("source_types", JSONB(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("upload_id", sa.Integer(), nullable=True),
        sa.Column("cloned_from_id", sa.Integer(), nullable=True),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("legacy_id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["upload_id"], ["uploads.id"]),
        sa.ForeignKeyConstraint(["cloned_from_id"], ["legacy_references.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
    )
    op.create_table(
        "legacy_reference_groups",
        sa.Column("reference_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("build", sa.Boolean(), nullable=False),
        sa.Column("modify", sa.Boolean(), nullable=False),
        sa.Column("modify_otu", sa.Boolean(), nullable=False),
        sa.Column("remove", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("reference_id", "group_id"),
        sa.ForeignKeyConstraint(["reference_id"], ["legacy_references.id"]),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
    )
    op.create_table(
        "legacy_reference_users",
        sa.Column("reference_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("build", sa.Boolean(), nullable=False),
        sa.Column("modify", sa.Boolean(), nullable=False),
        sa.Column("modify_otu", sa.Boolean(), nullable=False),
        sa.Column("remove", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("reference_id", "user_id"),
        sa.ForeignKeyConstraint(["reference_id"], ["legacy_references.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )


def downgrade() -> None:
    op.drop_table("legacy_reference_users")
    op.drop_table("legacy_reference_groups")
    op.drop_table("legacy_references")
