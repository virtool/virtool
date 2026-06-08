"""add subtraction_files subtraction_id name unique constraint

Enforce uniqueness on ``(subtraction_id, name)`` now that ``subtraction_files``
rows are keyed by the integer FK instead of the legacy ``subtraction`` string.
This is what backs the "file name already exists" conflict check on upload.

The legacy ``(subtraction, name)`` constraint is left in place; it is dropped
alongside the ``subtraction`` column in a later cleanup revision. Existing rows
with a NULL ``subtraction_id`` do not collide because NULLs are distinct.

Revision ID: e31c352fd114
Revises: 743a03e550e0
Create Date: 2026-06-08 18:40:36.488285+00:00

"""

from alembic import op

revision = "e31c352fd114"
down_revision = "743a03e550e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "subtraction_files_subtraction_id_name_key",
        "subtraction_files",
        ["subtraction_id", "name"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "subtraction_files_subtraction_id_name_key",
        "subtraction_files",
        type_="unique",
    )
