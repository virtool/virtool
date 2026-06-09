"""convert session_type to text

Revision ID: 90330f98cf4e
Revises: 869aa923399e
Create Date: 2026-06-09 19:08:34.001251+00:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "90330f98cf4e"
down_revision = "869aa923399e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE sessions ALTER COLUMN session_type TYPE text "
        "USING session_type::text",
    )

    op.execute("DROP TYPE session_type_enum")

    op.create_check_constraint(
        "session_type_valid",
        "sessions",
        "session_type IN ('anonymous', 'authenticated', 'reset')",
    )


def downgrade() -> None:
    op.drop_constraint("session_type_valid", "sessions", type_="check")

    op.execute(
        "CREATE TYPE session_type_enum AS ENUM ('anonymous', 'authenticated', 'reset')",
    )

    op.execute(
        "ALTER TABLE sessions ALTER COLUMN session_type TYPE session_type_enum "
        "USING session_type::session_type_enum",
    )
