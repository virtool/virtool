"""delete ml model blobs

Permanently delete every ML model archive from object storage. The ML subsystem
has been removed and its ``ml_models`` and ``ml_model_releases`` tables are
dropped by the preceding Alembic revision; the release archives it wrote under
the ``ml/`` prefix (``ml/{release_id}/model.tar.gz``) are now orphaned and are
purged here.

Idempotent: ``delete_prefix`` lists whatever remains under ``ml/`` and is a
no-op once the objects are gone, so a re-run deletes nothing.

Revision ID: t15v503oih88
Date: 2026-07-02 17:04:56.659564

"""

import arrow
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.storage.cleanup import delete_prefix

logger = get_logger("migration")

# Revision identifiers.
name = "delete ml model blobs"
created_at = arrow.get("2026-07-02 17:04:56.659564")
revision_id = "t15v503oih88"

alembic_down_revision = "14c5bc110756"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None

ML_PREFIX = "ml/"


async def upgrade(ctx: MigrationContext) -> None:
    """Delete every ML model archive under the ``ml/`` prefix."""
    for key, exc in await delete_prefix(ctx.storage, ML_PREFIX):
        logger.error(
            "storage cleanup failed; file orphaned",
            prefix=ML_PREFIX,
            key=key,
            error=repr(exc),
        )
