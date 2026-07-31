"""make legacy analyses and index_files columns nullable

``analyses.reference``, ``analyses.index`` and ``index_files.index`` hold the
legacy Mongo strings that the ``reference_id`` and ``index_id`` foreign keys
replaced. They are still ``NOT NULL`` with no default, so any writer that omits
them — the TypeScript server's Drizzle mirror does — is rejected by Postgres.

Relax all three to nullable. They are not dropped yet: ``analyses.reference`` is
still read as a fallback when ``reference_id`` is ``NULL``, and no backfill has
populated ``analyses.reference_id`` for existing rows. The columns are dropped in
a later cleanup revision.

Revision ID: 9cea546d2cd3
Revises: af827765c1d5
Create Date: 2026-07-31 18:03:46.042189+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "9cea546d2cd3"
down_revision = "af827765c1d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("analyses", "reference", existing_type=sa.String(), nullable=True)
    op.alter_column("analyses", "index", existing_type=sa.String(), nullable=True)
    op.alter_column("index_files", "index", existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    op.alter_column("index_files", "index", existing_type=sa.String(), nullable=False)
    op.alter_column("analyses", "index", existing_type=sa.String(), nullable=False)
    op.alter_column("analyses", "reference", existing_type=sa.String(), nullable=False)
