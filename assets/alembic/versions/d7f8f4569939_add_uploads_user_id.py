"""add uploads user_id

Phase 1 of converting ``uploads."user"`` (VARCHAR) to
``uploads.user_id`` (INTEGER FK to ``users.id``). Purely additive so the
schema is compatible with both old and new application code during the
deploy window.

The migration:

- adds a nullable ``user_id INTEGER REFERENCES users(id)`` column,
- backfills it from the existing ``"user"`` column (digit-string →
  ``users.id``, otherwise → ``users.legacy_id``),
- raises if any row remains with NULL ``user_id`` (the production audit
  found zero such rows; this is a tripwire, not a fallback),
- installs a trigger that keeps ``user_id`` in sync on INSERT and on
  UPDATE OF ``"user"`` for as long as the old code path is still writing
  the string column.

Phase 2 will switch the model and data layer to ``user_id``. Phase 3 will
drop the trigger, set ``user_id`` NOT NULL, and drop the ``"user"``
column.

Revision ID: d7f8f4569939
Revises: c3a7e9b4d1f2
Create Date: 2026-05-25 22:24:47.242433+00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "d7f8f4569939"
down_revision = "c3a7e9b4d1f2"
branch_labels = None
depends_on = None


BACKFILL_BY_ID_SQL = """
UPDATE uploads
SET user_id = u.id
FROM users u
WHERE uploads.user_id IS NULL
  AND u.id = CASE
      WHEN uploads."user" ~ '^[0-9]+$' THEN uploads."user"::int
  END
"""

BACKFILL_BY_LEGACY_ID_SQL = """
UPDATE uploads
SET user_id = u.id
FROM users u
WHERE uploads.user_id IS NULL
  AND u.legacy_id = uploads."user"
"""

COUNT_UNMAPPED_SQL = """
SELECT COUNT(*) FROM uploads WHERE user_id IS NULL
"""

CREATE_TRIGGER_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION sync_uploads_user_id() RETURNS trigger AS $$
DECLARE
    resolved_id INTEGER;
BEGIN
    IF NEW."user" IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW."user" ~ '^[0-9]+$' THEN
        SELECT id INTO resolved_id FROM users WHERE id = NEW."user"::int;
    END IF;

    IF resolved_id IS NULL THEN
        SELECT id INTO resolved_id FROM users WHERE legacy_id = NEW."user";
    END IF;

    IF resolved_id IS NULL THEN
        RAISE EXCEPTION
            'uploads."user" value % does not resolve to a users row',
            NEW."user";
    END IF;

    NEW.user_id := resolved_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
"""

CREATE_TRIGGER_SQL = """
CREATE TRIGGER uploads_sync_user_id
BEFORE INSERT OR UPDATE OF "user" ON uploads
FOR EACH ROW
EXECUTE FUNCTION sync_uploads_user_id()
"""


def upgrade() -> None:
    op.add_column(
        "uploads",
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )

    op.execute(BACKFILL_BY_ID_SQL)
    op.execute(BACKFILL_BY_LEGACY_ID_SQL)

    unmapped = op.get_bind().execute(sa.text(COUNT_UNMAPPED_SQL)).scalar()

    if unmapped:
        msg = (
            f"{unmapped} uploads row(s) could not be mapped to a users.id; "
            "refusing to proceed"
        )
        raise RuntimeError(msg)

    op.execute(CREATE_TRIGGER_FUNCTION_SQL)
    op.execute(CREATE_TRIGGER_SQL)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS uploads_sync_user_id ON uploads")
    op.execute("DROP FUNCTION IF EXISTS sync_uploads_user_id()")
    op.drop_column("uploads", "user_id")
