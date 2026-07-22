"""cascade sample label and subtraction links

Add ``ON DELETE CASCADE`` to the ``sample_id`` foreign keys on the
``legacy_sample_labels`` and ``legacy_sample_subtractions`` join tables so that
deleting a sample removes its label and subtraction links at the database level.

Both columns are the NOT NULL integer primary key of their join table and have
no legacy-string fallback, so the cascade fully replaces the manual pre-deletes
that ``SamplesData.delete`` previously issued purely to satisfy the constraint.

Each foreign key is dropped and recreated in place with ``ondelete="CASCADE"``;
downgrade restores the default ``NO ACTION`` behaviour.

Revision ID: 06d0b71c37c3
Revises: c976a55c3382
Create Date: 2026-07-21 22:19:21.831964+00:00

"""

from alembic import op

revision = "06d0b71c37c3"
down_revision = "c976a55c3382"
branch_labels = None
depends_on = None


_CASCADES = (
    ("legacy_sample_labels", "legacy_sample_labels_sample_id_fkey"),
    ("legacy_sample_subtractions", "legacy_sample_subtractions_sample_id_fkey"),
)


def upgrade() -> None:
    for table, constraint in _CASCADES:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint,
            table,
            "legacy_samples",
            ["sample_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    for table, constraint in _CASCADES:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint,
            table,
            "legacy_samples",
            ["sample_id"],
            ["id"],
        )
