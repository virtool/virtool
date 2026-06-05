"""convert analysis_files and nuvs_blast to integer analysis fks

Promote the two dependent tables that still reference an analysis by its Mongo
slug to real integer foreign keys against ``analyses.id`` with
``ON DELETE CASCADE``.

- ``analysis_files.analysis`` (VARCHAR slug) becomes ``analysis_files.analysis_id``
  (BIGINT FK).
- ``nuvs_blast.analysis_id`` (VARCHAR slug) is replaced in place by a BIGINT FK
  of the same name; its ``(analysis_id, sequence_index)`` unique constraint is
  recreated on the integer column.

Both columns are backfilled by joining ``analyses.legacy_id``. Any row that does
not resolve to an analysis aborts the migration loudly rather than being dropped
or left NULL.

Revision ID: f51a03fa6f9a
Revises: 840040ca7266
Create Date: 2026-06-05 22:41:04.758568+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f51a03fa6f9a"
down_revision = "840040ca7266"
branch_labels = None
depends_on = None


def _abort_if_unmapped(table: str, column: str) -> None:
    """Raise if any row in ``table`` has a NULL ``column`` after backfill."""
    unmapped = (
        op.get_bind()
        .execute(sa.text(f"SELECT COUNT(*) FROM {table} WHERE {column} IS NULL"))  # noqa: S608
        .scalar()
    )

    if unmapped:
        msg = (
            f"{unmapped} {table} row(s) could not be mapped to an analyses.id; "
            "refusing to proceed"
        )
        raise RuntimeError(msg)


def upgrade() -> None:
    # analysis_files.analysis (VARCHAR) -> analysis_files.analysis_id (BIGINT FK).
    op.add_column(
        "analysis_files",
        sa.Column("analysis_id", sa.BigInteger(), nullable=True),
    )

    op.execute(
        """
        UPDATE analysis_files
        SET analysis_id = analyses.id
        FROM analyses
        WHERE analyses.legacy_id = analysis_files.analysis
        """,
    )

    _abort_if_unmapped("analysis_files", "analysis_id")

    op.drop_column("analysis_files", "analysis")

    op.alter_column("analysis_files", "analysis_id", nullable=False)

    op.create_foreign_key(
        "analysis_files_analysis_id_fkey",
        "analysis_files",
        "analyses",
        ["analysis_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # nuvs_blast.analysis_id (VARCHAR) -> nuvs_blast.analysis_id (BIGINT FK).
    op.drop_constraint(
        "nuvs_blast_analysis_id_sequence_index_key",
        "nuvs_blast",
        type_="unique",
    )

    op.add_column(
        "nuvs_blast",
        sa.Column("analysis_id_int", sa.BigInteger(), nullable=True),
    )

    op.execute(
        """
        UPDATE nuvs_blast
        SET analysis_id_int = analyses.id
        FROM analyses
        WHERE analyses.legacy_id = nuvs_blast.analysis_id
        """,
    )

    _abort_if_unmapped("nuvs_blast", "analysis_id_int")

    op.drop_column("nuvs_blast", "analysis_id")

    op.alter_column(
        "nuvs_blast",
        "analysis_id_int",
        new_column_name="analysis_id",
        nullable=False,
    )

    op.create_foreign_key(
        "nuvs_blast_analysis_id_fkey",
        "nuvs_blast",
        "analyses",
        ["analysis_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_unique_constraint(
        "nuvs_blast_analysis_id_sequence_index_key",
        "nuvs_blast",
        ["analysis_id", "sequence_index"],
    )


def downgrade() -> None:
    # nuvs_blast.analysis_id (BIGINT FK) -> nuvs_blast.analysis_id (VARCHAR slug).
    op.drop_constraint(
        "nuvs_blast_analysis_id_sequence_index_key",
        "nuvs_blast",
        type_="unique",
    )

    op.drop_constraint("nuvs_blast_analysis_id_fkey", "nuvs_blast", type_="foreignkey")

    op.add_column(
        "nuvs_blast",
        sa.Column("analysis_slug", sa.String(), nullable=True),
    )

    op.execute(
        """
        UPDATE nuvs_blast
        SET analysis_slug = analyses.legacy_id
        FROM analyses
        WHERE analyses.id = nuvs_blast.analysis_id
        """,
    )

    _abort_if_unmapped("nuvs_blast", "analysis_slug")

    op.drop_column("nuvs_blast", "analysis_id")

    op.alter_column(
        "nuvs_blast",
        "analysis_slug",
        new_column_name="analysis_id",
        nullable=False,
    )

    op.create_unique_constraint(
        "nuvs_blast_analysis_id_sequence_index_key",
        "nuvs_blast",
        ["analysis_id", "sequence_index"],
    )

    # analysis_files.analysis_id (BIGINT FK) -> analysis_files.analysis (VARCHAR slug).
    op.drop_constraint(
        "analysis_files_analysis_id_fkey",
        "analysis_files",
        type_="foreignkey",
    )

    op.add_column(
        "analysis_files",
        sa.Column("analysis", sa.String(), nullable=True),
    )

    op.execute(
        """
        UPDATE analysis_files
        SET analysis = analyses.legacy_id
        FROM analyses
        WHERE analyses.id = analysis_files.analysis_id
        """,
    )

    op.drop_column("analysis_files", "analysis_id")
