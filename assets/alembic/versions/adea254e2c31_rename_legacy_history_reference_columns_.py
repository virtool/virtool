"""rename legacy_history reference columns to bare names

Revision ID: adea254e2c31
Revises: 482fb0891b9b
Create Date: 2026-06-08 21:41:56.133138+00:00

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "adea254e2c31"
down_revision = "482fb0891b9b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("legacy_history", "otu_id", new_column_name="otu")
    op.alter_column("legacy_history", "reference_id", new_column_name="reference")
    op.alter_column("legacy_history", "index_id", new_column_name="index")

    op.execute(
        "ALTER INDEX ix_legacy_history_otu_id_otu_version "
        "RENAME TO ix_legacy_history_otu_otu_version",
    )
    op.execute(
        "ALTER INDEX ix_legacy_history_reference_id "
        "RENAME TO ix_legacy_history_reference",
    )
    op.execute(
        "ALTER INDEX ix_legacy_history_index_id RENAME TO ix_legacy_history_index",
    )


def downgrade() -> None:
    op.execute(
        "ALTER INDEX ix_legacy_history_index RENAME TO ix_legacy_history_index_id",
    )
    op.execute(
        "ALTER INDEX ix_legacy_history_reference "
        "RENAME TO ix_legacy_history_reference_id",
    )
    op.execute(
        "ALTER INDEX ix_legacy_history_otu_otu_version "
        "RENAME TO ix_legacy_history_otu_id_otu_version",
    )

    op.alter_column("legacy_history", "index", new_column_name="index_id")
    op.alter_column("legacy_history", "reference", new_column_name="reference_id")
    op.alter_column("legacy_history", "otu", new_column_name="otu_id")
