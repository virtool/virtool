"""drop dormant sample artifacts table

Revision ID: b253add43d69
Revises: 0cbbc3b23245
Create Date: 2026-08-06 19:21:44.783991+00:00

No workflow writes sample artifacts and no client reads them. The only endpoint
that could produce a row is unused, so the table is dropped along with the
Python that served it.

This finishes the cleanup started by ``7ea2f370163c``, which dropped
``sample_artifacts_cache`` and ``sample_reads_cache`` but had to leave the
``artifacttype`` enum behind for this table. With both users gone the enum is
dropped too.

Objects belonging to surviving rows are swept by the ``delete sample artifact
objects`` Virtool revision, which runs immediately before this one and needs the
table to still be there.

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b253add43d69"
down_revision = "0cbbc3b23245"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS sample_artifacts")
    op.execute("DROP TYPE IF EXISTS artifacttype")


def downgrade() -> None:
    pass
