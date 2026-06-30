"""replace uploadtype enum with text check

Revision ID: ed265b939a84
Revises: 2b53ffa573a3
Create Date: 2026-06-30 01:19:24.545633+00:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "ed265b939a84"
down_revision = "2b53ffa573a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM uploads WHERE type = 'hmm'")

    op.execute(
        "ALTER TABLE uploads ALTER COLUMN type TYPE text USING type::text",
    )

    op.execute("DROP TYPE uploadtype")

    op.create_check_constraint(
        "ck_uploads_type",
        "uploads",
        "type IN ('reference', 'reads', 'subtraction')",
    )


def downgrade() -> None:
    # The upgrade deletes rows with type 'hmm'. That deletion is not reversible:
    # the rows are gone and cannot be restored on downgrade.
    op.drop_constraint("ck_uploads_type", "uploads", type_="check")

    op.execute(
        "CREATE TYPE uploadtype AS ENUM ('hmm', 'reference', 'reads', 'subtraction')",
    )

    # Coerce any value outside the recreated enum to NULL so the cast cannot fail
    # on rows written while the column was free-form text.
    op.execute(
        "UPDATE uploads SET type = NULL "
        "WHERE type NOT IN ('hmm', 'reference', 'reads', 'subtraction')",
    )

    op.execute(
        "ALTER TABLE uploads ALTER COLUMN type TYPE uploadtype USING type::uploadtype",
    )
