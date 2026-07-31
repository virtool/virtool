"""make legacy analyses and index_files columns nullable

``analyses.reference``, ``analyses.index`` and ``index_files.index`` hold the
legacy Mongo strings that the ``reference_id`` and ``index_id`` foreign keys
replaced. They are still ``NOT NULL`` with no default, so any writer that omits
them — the TypeScript server's Drizzle mirror does — is rejected by Postgres.

Relax all three to nullable. They are not dropped yet: ``analyses.reference`` is
still read as a fallback when ``reference_id`` is ``NULL``. The columns are
dropped in a later cleanup revision.

That ``NOT NULL`` was incidentally guaranteeing that every analysis names its
reference and its index in one form or the other. Dropping it alone would let a
writer that omits both the legacy string and the foreign key insert a row that
cannot be read back, so each side gets a replacement guarantee:

- ``index_id`` becomes ``NOT NULL``. The backfill in ``rev_bn8b4pzfvokk`` raises
  rather than leaving a row unresolved, so every existing row already has one;
  a tripwire refuses the upgrade if that is not true. Together with the existing
  foreign key this makes an analysis's index always resolvable.
- ``reference_id`` cannot be tightened the same way because no backfill has
  populated it, so the ``ck_analyses_reference_present`` check constraint carries
  the weaker invariant instead: legacy rows satisfy it through the string, rows
  written against the foreign key satisfy it through the integer. It is replaced
  by ``NOT NULL`` once ``reference_id`` is backfilled.

``index_files`` needs no equivalent because ``index_id`` is already ``NOT NULL``
there, set by ``f61c6dbf7ff6``.

Downgrade restores the ``NOT NULL`` string columns and therefore fails once any
row has been written without them. That is intended: there is no correct value to
backfill, and fabricating one would corrupt the reference and index linkage.

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

COUNT_NULL_INDEX_ID_SQL = """
SELECT COUNT(*) FROM analyses WHERE index_id IS NULL
"""


def upgrade() -> None:
    op.alter_column("analyses", "reference", existing_type=sa.String(), nullable=True)
    op.alter_column("analyses", "index", existing_type=sa.String(), nullable=True)
    op.alter_column("index_files", "index", existing_type=sa.String(), nullable=True)

    null_count = op.get_bind().execute(sa.text(COUNT_NULL_INDEX_ID_SQL)).scalar()

    if null_count:
        msg = (
            f"{null_count} analyses row(s) have NULL index_id; refusing to set NOT NULL"
        )
        raise RuntimeError(msg)

    op.alter_column(
        "analyses", "index_id", existing_type=sa.BigInteger(), nullable=False
    )

    op.create_check_constraint(
        "ck_analyses_reference_present",
        "analyses",
        "num_nonnulls(reference, reference_id) >= 1",
    )


def downgrade() -> None:
    op.drop_constraint("ck_analyses_reference_present", "analyses", type_="check")

    op.alter_column(
        "analyses", "index_id", existing_type=sa.BigInteger(), nullable=True
    )

    op.alter_column("index_files", "index", existing_type=sa.String(), nullable=False)
    op.alter_column("analyses", "index", existing_type=sa.String(), nullable=False)
    op.alter_column("analyses", "reference", existing_type=sa.String(), nullable=False)
