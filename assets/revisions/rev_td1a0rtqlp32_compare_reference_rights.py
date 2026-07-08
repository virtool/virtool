"""Compare Mongo and Postgres reference rights before the read cutover.

A read-only gating check run after the reference backfill and before authorization
and reference reads switch to Postgres. It verifies that every reference's embedded
Mongo ``groups``/``users`` rights arrays match the backfilled
``legacy_reference_groups``/``legacy_reference_users`` tables, and raises on any
drift so the cutover cannot proceed against inconsistent data.

The implementation lives in :func:`compare_reference_rights`.

Revision ID: td1a0rtqlp32
Date: 2026-07-08 19:41:57.222957

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.references.migration import compare_reference_rights

logger = get_logger("migration")

# Revision identifiers.
name = "compare reference rights"
created_at = arrow.get("2026-07-08 19:41:57.222957")
revision_id = "td1a0rtqlp32"

alembic_down_revision = None
virtool_down_revision = "tr3p2obxndjm"

# ``fe83de8410d3`` leaves the reference rights tables in their final shape (no
# ``remove``, no ``created_at``), the same guard the reference backfill uses.
required_alembic_revision = "fe83de8410d3"


async def upgrade(ctx: MigrationContext) -> None:
    """Fail loudly if Mongo and Postgres reference rights disagree.

    The implementation lives in :func:`compare_reference_rights`.
    """
    await compare_reference_rights(ctx)
