"""re-key history diffs to legacy_history_diff

Revision ID: a329dfd5ba23
Revises: 14c5bc110756
Create Date: 2026-07-02 18:06:34.126679+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a329dfd5ba23"
down_revision = "14c5bc110756"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Re-key the diff side table from ``change_id`` to an integer ``history_id`` FK.

    The table is renamed ``history_diffs`` -> ``legacy_history_diff`` and gains a
    nullable ``history_id`` BigInteger foreign key to ``legacy_history.id``. Existing
    rows are backfilled by joining the old string ``change_id`` to
    ``legacy_history.legacy_id``. The old ``change_id`` column is intentionally left
    in place; it is dropped in a later cleanup revision once production stability is
    confirmed.
    """
    op.rename_table("history_diffs", "legacy_history_diff")

    op.add_column(
        "legacy_history_diff",
        sa.Column("history_id", sa.BigInteger(), nullable=True),
    )

    op.execute(
        """
        UPDATE legacy_history_diff AS d
        SET history_id = h.id
        FROM legacy_history AS h
        WHERE h.legacy_id = d.change_id
        """,
    )

    op.create_foreign_key(
        "legacy_history_diff_history_id_fkey",
        "legacy_history_diff",
        "legacy_history",
        ["history_id"],
        ["id"],
    )

    op.create_unique_constraint(
        "legacy_history_diff_history_id_key",
        "legacy_history_diff",
        ["history_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "legacy_history_diff_history_id_key",
        "legacy_history_diff",
        type_="unique",
    )

    op.drop_constraint(
        "legacy_history_diff_history_id_fkey",
        "legacy_history_diff",
        type_="foreignkey",
    )

    op.drop_column("legacy_history_diff", "history_id")

    op.rename_table("legacy_history_diff", "history_diffs")
