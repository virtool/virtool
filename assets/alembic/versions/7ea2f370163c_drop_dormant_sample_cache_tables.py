"""drop dormant sample cache tables

Revision ID: 7ea2f370163c
Revises: 5cb4e85e013f
Create Date: 2026-06-02 14:47:23.211146+00:00

The ``sample_artifacts_cache`` and ``sample_reads_cache`` tables are leftovers
from a sample-caching feature whose Python code was removed in May 2024. They
have been unread and unwritten since, so this migration drops them.

The ``DROP TABLE IF EXISTS`` guards make the migration safe on deployments that
never had these tables. The ``artifacttype`` enum is intentionally left in
place: it is still used by the live ``sample_artifacts`` table.

Legacy on-disk cache artifacts under ``{data_path}/caches/`` are handled by a
separate ops step, not this migration, so no filesystem work happens here.

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "7ea2f370163c"
down_revision = "5cb4e85e013f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS sample_reads_cache")
    op.execute("DROP TABLE IF EXISTS sample_artifacts_cache")


def downgrade() -> None:
    pass
