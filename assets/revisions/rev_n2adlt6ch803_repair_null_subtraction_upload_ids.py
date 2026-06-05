"""Repair subtractions left with a null upload_id by the original backfill.

The Mongo-to-Postgres subtraction backfill wrote ``upload_id = NULL`` whenever a
subtraction's source upload had been deleted. The read path rebuilds the required
``file`` field from the joined upload, so those rows raised a validation error
when listed (VIR-2478).

This revision rebuilds a ``removed`` stand-in upload from the Mongo ``file``
snapshot for every non-deleted subtraction still carrying a null ``upload_id``
and links it, restoring the always-present subtraction-to-upload relation. It is
idempotent: only null ``upload_id`` rows are touched.

Revision ID: n2adlt6ch803
Date: 2026-06-05 18:49:21.970400

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.subtractions.migration import repair_null_subtraction_uploads

logger = get_logger("migration")

# Revision identifiers.
name = "repair null subtraction upload ids"
created_at = arrow.get("2026-06-05 18:49:21.970400")
revision_id = "n2adlt6ch803"

alembic_down_revision = None
virtool_down_revision = "ld2t6tbwulbd"

# ``895d6315a838`` adds ``subtraction_files.subtraction_id`` and depends on
# ``f4624eb353b7`` (create subtractions table). Requiring it guarantees the
# subtractions, subtraction_files, and uploads tables all exist before this runs.
required_alembic_revision = "895d6315a838"


async def upgrade(ctx: MigrationContext) -> None:
    """Reconstruct removed uploads for subtractions with a null upload_id."""
    await repair_null_subtraction_uploads(ctx)
