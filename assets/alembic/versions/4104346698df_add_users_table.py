"""add users table

Revision ID: 4104346698df
Revises: f8ad70032e9c
Create Date: 2023-11-09 23:09:11.774165+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "4104346698df"
down_revision = "f8ad70032e9c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("legacy_id", sa.String(), nullable=True, unique=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("administrator", sa.Boolean(), nullable=False),
        sa.Column("b2c_display_name", sa.String(), nullable=False),
        sa.Column("b2c_given_name", sa.String(), nullable=False),
        sa.Column("b2c_family_name", sa.String(), nullable=False),
        sa.Column("b2c_oid", sa.String(), nullable=False),
        sa.Column("force_reset", sa.Boolean(), nullable=False),
        sa.Column("handle", sa.String(), nullable=False),
        sa.Column("invalidate_sessions", sa.Boolean(), nullable=False),
        sa.Column("last_password_change", sa.DateTime(), nullable=False),
        sa.Column("password", sa.LargeBinary, nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.Column("primary_group", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["primary_group"], ["groups.id"]),
    )

    op.create_table(
        "user_group_associations",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
    )


def downgrade() -> None:
    op.drop_table("users")
    op.drop_table("user_group_associations")
