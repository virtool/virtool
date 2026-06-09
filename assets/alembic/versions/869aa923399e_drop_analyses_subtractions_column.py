"""drop analyses subtractions column

Step 3 of normalizing ``analyses.subtractions``. Verifies that every resolvable
JSONB subtraction reference is present in ``analysis_subtractions`` before
dropping the now-redundant JSONB column. The tripwire makes the irreversible
drop safe to run only once the backfill has succeeded.

The downgrade rebuilds the JSONB array from the association table, emitting the
legacy slug when present and the stringified integer id otherwise -- the same
identifier form the read path emits.

Revision ID: 869aa923399e
Revises: eb5cf4abd58a
Create Date: 2026-06-08 22:24:08.186004+00:00

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "869aa923399e"
down_revision = "eb5cf4abd58a"
branch_labels = None
depends_on = None


MISSING_REFERENCES_SQL = """
SELECT count(*)
FROM (
    SELECT refs.analysis_id, s.id AS subtraction_id
    FROM (
        SELECT
            a.id AS analysis_id,
            ref.value AS legacy_value,
            CASE WHEN ref.value ~ '^[0-9]+$' THEN ref.value::bigint END AS int_value
        FROM analyses a
        JOIN LATERAL jsonb_array_elements_text(
            CASE
                WHEN jsonb_typeof(a.subtractions) = 'array' THEN a.subtractions
                ELSE '[]'::jsonb
            END
        ) AS ref(value) ON TRUE
    ) refs
    JOIN subtractions s
        ON s.id = refs.int_value
        OR (refs.int_value IS NULL AND s.legacy_id = refs.legacy_value)
) resolved
LEFT JOIN analysis_subtractions link
    ON link.analysis_id = resolved.analysis_id
    AND link.subtraction_id = resolved.subtraction_id
WHERE link.analysis_id IS NULL
"""

REBUILD_SQL = """
UPDATE analyses a
SET subtractions = COALESCE(agg.refs, '[]'::jsonb)
FROM (
    SELECT link.analysis_id,
           jsonb_agg(COALESCE(s.legacy_id, s.id::text)) AS refs
    FROM analysis_subtractions link
    JOIN subtractions s ON s.id = link.subtraction_id
    GROUP BY link.analysis_id
) agg
WHERE a.id = agg.analysis_id
"""


def upgrade() -> None:
    missing = op.get_bind().execute(sa.text(MISSING_REFERENCES_SQL)).scalar_one()

    if missing:
        raise RuntimeError(
            f"{missing} analysis subtraction references are missing from "
            "analysis_subtractions; run the backfill before dropping the column",
        )

    op.drop_column("analyses", "subtractions")


def downgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column(
            "subtractions",
            postgresql.JSONB(),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )

    op.execute(REBUILD_SQL)

    op.alter_column("analyses", "subtractions", server_default=None)
