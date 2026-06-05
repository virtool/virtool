"""convert administrator_role to text

Revision ID: 997cf9a66f10
Revises: 840040ca7266
Create Date: 2026-06-05 22:08:42.643011+00:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "997cf9a66f10"
down_revision = "840040ca7266"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE users SET administrator_role = 'base' "
        "WHERE administrator_role = 'spaces'",
    )

    op.execute(
        "ALTER TABLE users ALTER COLUMN administrator_role TYPE text "
        "USING administrator_role::text",
    )

    op.execute("DROP TYPE administratorrole")

    op.create_check_constraint(
        "administrator_role_valid",
        "users",
        "administrator_role IN ('full', 'settings', 'users', 'base')",
    )


def downgrade() -> None:
    op.drop_constraint("administrator_role_valid", "users", type_="check")

    op.execute(
        "CREATE TYPE administratorrole AS ENUM "
        "('full', 'settings', 'spaces', 'users', 'base')",
    )

    op.execute(
        "ALTER TABLE users ALTER COLUMN administrator_role TYPE administratorrole "
        "USING administrator_role::administratorrole",
    )
