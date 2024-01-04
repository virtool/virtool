"""update user schema

Revision ID: 5df816cef12f
Revises: 77be1d95da09
Create Date: 2024-01-04 01:39:59.377946+00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "5df816cef12f"
down_revision = "77be1d95da09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Upgrade the schema for the final implementation of users.

    * Bring back the `settings` field as a JSONB column.
    * Drop the `administrator` and `primary_key_id` columns and associated constraint.
    * Drop the `user_group_associations` table and replace it with `user_groups`. Add a
      unique index on `user_groups` for the `primary` and `user_id` columns to ensure
      that each user has only one primary group.
    *

    """
    op.create_table(
        "user_groups",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("primary", sa.Boolean(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("group_id", "user_id"),
    )
    op.create_index(
        "primary_group_unique",
        "user_groups",
        ["primary", "user_id"],
        unique=True,
        postgresql_where=False,
    )
    op.drop_table("user_group_associations")
    op.add_column(
        "users",
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    )
    op.alter_column("users", "b2c_oid", existing_type=sa.VARCHAR(), nullable=True)
    op.drop_constraint("users_primary_group_fkey", "users", type_="foreignkey")
    op.drop_column("users", "primary_group_id")
    op.drop_column("users", "administrator")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("administrator", sa.BOOLEAN(), autoincrement=False, nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("primary_group_id", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.create_foreign_key(
        "users_primary_group_fkey", "users", "groups", ["primary_group_id"], ["id"]
    )
    op.alter_column("users", "b2c_oid", existing_type=sa.VARCHAR(), nullable=False)
    op.drop_column("users", "settings")
    op.create_table(
        "user_group_associations",
        sa.Column("user_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("group_id", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["group_id"], ["groups.id"], name="user_group_associations_group_id_fkey"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="user_group_associations_user_id_fkey"
        ),
    )
    op.drop_index(
        "primary_group_unique", table_name="user_groups", postgresql_where=False
    )
    op.drop_table("user_groups")
