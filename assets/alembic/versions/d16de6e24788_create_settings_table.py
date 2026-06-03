"""create settings table

Revision ID: d16de6e24788
Revises: c24b524f77e3
Create Date: 2026-05-29 05:13:09.463816+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "d16de6e24788"
down_revision = "c24b524f77e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "settings",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("default_source_types", JSONB(), nullable=False),
        sa.Column("enable_api", sa.Boolean(), nullable=False),
        sa.Column("enable_sentry", sa.Boolean(), nullable=False),
        sa.Column("minimum_password_length", sa.Integer(), nullable=False),
        sa.Column("sample_all_read", sa.Boolean(), nullable=False),
        sa.Column("sample_all_write", sa.Boolean(), nullable=False),
        sa.Column("sample_group", sa.String(), nullable=False),
        sa.Column("sample_group_read", sa.Boolean(), nullable=False),
        sa.Column("sample_group_write", sa.Boolean(), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_settings_singleton"),
        sa.CheckConstraint(
            "sample_group IN ('none', 'force_choice', 'users_primary_group')",
            name="ck_settings_sample_group",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.bulk_insert(
        sa.table(
            "settings",
            sa.column("id", sa.Integer),
            sa.column("default_source_types", JSONB),
            sa.column("enable_api", sa.Boolean),
            sa.column("enable_sentry", sa.Boolean),
            sa.column("minimum_password_length", sa.Integer),
            sa.column("sample_all_read", sa.Boolean),
            sa.column("sample_all_write", sa.Boolean),
            sa.column("sample_group", sa.String),
            sa.column("sample_group_read", sa.Boolean),
            sa.column("sample_group_write", sa.Boolean),
        ),
        [
            {
                "id": 1,
                "default_source_types": ["isolate", "strain"],
                "enable_api": False,
                "enable_sentry": True,
                "minimum_password_length": 8,
                "sample_all_read": True,
                "sample_all_write": False,
                "sample_group": "none",
                "sample_group_read": True,
                "sample_group_write": False,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("settings")
