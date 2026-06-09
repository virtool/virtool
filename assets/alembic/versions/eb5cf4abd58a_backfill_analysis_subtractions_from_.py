"""backfill analysis_subtractions from jsonb

Step 2 of normalizing ``analyses.subtractions``. Expands each analysis' JSONB
array of subtraction references and resolves every element to an integer
``subtractions.id``: digit-string elements match the modern integer id, all
other elements match the legacy slug. Idempotent via ``ON CONFLICT DO NOTHING``.

References that resolve to no subtraction are skipped; the pre-normalization
read path already required every referenced subtraction to exist, so a dangling
reference was never readable.

Revision ID: eb5cf4abd58a
Revises: 0536aee705e9
Create Date: 2026-06-08 22:24:03.524373+00:00

"""

from alembic import op

revision = "eb5cf4abd58a"
down_revision = "0536aee705e9"
branch_labels = None
depends_on = None


BACKFILL_SQL = """
INSERT INTO analysis_subtractions (analysis_id, subtraction_id)
SELECT refs.analysis_id, s.id
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
ON CONFLICT (analysis_id, subtraction_id) DO NOTHING
"""


def upgrade() -> None:
    op.execute(BACKFILL_SQL)


def downgrade() -> None:
    op.execute("TRUNCATE TABLE analysis_subtractions")
