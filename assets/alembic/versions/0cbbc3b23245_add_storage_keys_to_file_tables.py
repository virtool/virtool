"""add storage keys to file tables

Records each tracked storage object's key on the row that names it, instead of
deriving it from the parent resource's database identity at read time.

Every backfill reproduces the key the current read path composes, byte for byte,
so no object moves. Keys minted from now on are ``{domain}/{parent_id}/{uuid}``,
which is why the values stay heterogeneous: migrated rows keep the Mongo slug or
integer id they were written under, and only new rows get a UUID.

``sample_reads`` and ``sample_artifacts`` derive from different columns because
their read paths do: ``SampleData.get_reads_file`` keys off ``name`` while
``SampleData.get_artifact_file`` keys off ``name_on_disk``. Rows created by the
server set both to the same value, but migrated rows are not guaranteed to, so
each backfill follows its own reader rather than assuming they agree.

``storage_key`` is ``NOT NULL`` only where every column it derives from is.
Where a source column is nullable a row can exist that names no retrievable
object -- the derived key would have embedded a literal ``None`` -- and a NULL
storage key states that faithfully rather than fabricating one.

Revision ID: 0cbbc3b23245
Revises: cb89fbb68f58
Create Date: 2026-08-05 19:43:04.909891+00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0cbbc3b23245"
down_revision = "cb89fbb68f58"
branch_labels = None
depends_on = None


BACKFILLS = (
    (
        "sample_reads",
        """
        UPDATE sample_reads
        SET storage_key = 'samples/' || sample || '/' || name
        """,
    ),
    (
        "sample_artifacts",
        """
        UPDATE sample_artifacts
        SET storage_key = 'samples/' || sample || '/' || name_on_disk
        WHERE name_on_disk IS NOT NULL
        """,
    ),
    (
        "subtraction_files",
        """
        UPDATE subtraction_files f
        SET storage_key =
            'subtractions/'
            || replace(coalesce(s.legacy_id, s.id::text), ' ', '_')
            || '/'
            || f.name
        FROM subtractions s
        WHERE s.id = f.subtraction_id AND f.name IS NOT NULL
        """,
    ),
    (
        "index_files",
        """
        UPDATE index_files f
        SET storage_key = 'indexes/' || i.storage_key || '/' || f.name
        FROM indexes i
        WHERE i.id = f.index_id
        """,
    ),
    (
        "analysis_files",
        """
        UPDATE analysis_files
        SET storage_key = 'analyses/' || name_on_disk
        WHERE name_on_disk IS NOT NULL
        """,
    ),
    (
        "uploads",
        """
        UPDATE uploads
        SET storage_key = 'files/' || name_on_disk
        WHERE name_on_disk IS NOT NULL
        """,
    ),
)

NOT_NULL = ("sample_reads", "index_files")

# The compressed OTU JSON is materialized on demand and deliberately has no
# ``index_files`` row, so its key is recorded on the index itself. Every index
# gets the key it would have derived, whether or not the object has ever been
# written: ``get_otus_json`` writes on a miss either way.
OTUS_JSON_BACKFILL = """
UPDATE indexes
SET otus_json_storage_key = 'indexes/' || storage_key || '/otus.json.gz'
"""


def upgrade() -> None:
    for table, backfill in BACKFILLS:
        op.add_column(table, sa.Column("storage_key", sa.String(), nullable=True))
        op.execute(backfill)
        op.create_unique_constraint(f"uq_{table}_storage_key", table, ["storage_key"])

        if table in NOT_NULL:
            op.alter_column(table, "storage_key", nullable=False)

    op.add_column(
        "indexes", sa.Column("otus_json_storage_key", sa.String(), nullable=True)
    )
    op.execute(OTUS_JSON_BACKFILL)
    op.create_unique_constraint(
        "uq_indexes_otus_json_storage_key", "indexes", ["otus_json_storage_key"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_indexes_otus_json_storage_key", "indexes", type_="unique")
    op.drop_column("indexes", "otus_json_storage_key")

    for table, _ in BACKFILLS:
        op.drop_constraint(f"uq_{table}_storage_key", table, type_="unique")
        op.drop_column(table, "storage_key")
