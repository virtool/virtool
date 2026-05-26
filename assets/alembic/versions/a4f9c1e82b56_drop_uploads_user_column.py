"""drop uploads user column

Phase 3 of converting ``uploads."user"`` (VARCHAR) to
``uploads.user_id`` (INTEGER FK to ``users.id``). Destructive schema
cleanup that runs only after Phase 2 has been live long enough that
rolling back past it is unacceptable.

The migration:

- drops the ``uploads_sync_user_id`` trigger and its
  ``sync_uploads_user_id()`` function installed in Phase 1 (trigger
  first so it cannot fire spuriously during the column drop),
- raises if any row still has NULL ``user_id`` (tripwire; Phase 1
  backfilled everything and the trigger has been populating new rows),
- sets ``user_id`` NOT NULL,
- drops the legacy ``"user"`` column.

Rolling back past this migration requires restoring the column and
re-running the Phase 1 backfill.

Revision ID: a4f9c1e82b56
Revises: d7f8f4569939
Create Date: 2026-05-26 00:47:17.514003+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "a4f9c1e82b56"
down_revision = "d7f8f4569939"
branch_labels = None
depends_on = None


COUNT_NULL_USER_ID_SQL = """
SELECT COUNT(*) FROM uploads WHERE user_id IS NULL
"""


def upgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS uploads_sync_user_id ON uploads")
    op.execute("DROP FUNCTION IF EXISTS sync_uploads_user_id()")

    null_count = op.get_bind().execute(sa.text(COUNT_NULL_USER_ID_SQL)).scalar()

    if null_count:
        msg = f"{null_count} uploads row(s) have NULL user_id; refusing to set NOT NULL"
        raise RuntimeError(msg)

    op.alter_column("uploads", "user_id", nullable=False)
    op.drop_column("uploads", "user")


def downgrade() -> None:
    op.add_column("uploads", sa.Column("user", sa.String(), nullable=True))
    op.alter_column("uploads", "user_id", nullable=True)
