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
    # The upgrade remaps 'spaces' -> 'base'. That remap is not reversible: there
    # is no way to tell which 'base' rows were originally 'spaces', so downgraded
    # rows keep 'base'.
    op.drop_constraint("administrator_role_valid", "users", type_="check")

    op.execute(
        "CREATE TYPE administratorrole AS ENUM "
        "('full', 'settings', 'spaces', 'users', 'base')",
    )

    # Coerce any value outside the recreated enum to NULL so the cast cannot fail
    # on rows written while the column was free-form text.
    op.execute(
        "UPDATE users SET administrator_role = NULL "
        "WHERE administrator_role NOT IN "
        "('full', 'settings', 'spaces', 'users', 'base')",
    )

    op.execute(
        "ALTER TABLE users ALTER COLUMN administrator_role TYPE administratorrole "
        "USING administrator_role::administratorrole",
    )
