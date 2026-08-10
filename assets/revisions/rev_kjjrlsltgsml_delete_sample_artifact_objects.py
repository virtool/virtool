"""delete sample artifact objects

The ``sample_artifacts`` table is dropped by the Alembic revision that follows
this one. Nothing has written to it since the endpoint that fed it fell out of
use, but any row that did survive names an object in storage that no row will
name once the table is gone.

Only keys that no other table claims are deleted. A ``sample_reads`` row can
share an artifact's key: both derive from ``samples/{sample}/{filename}`` and an
artifact named ``reads_1.fq.gz`` would land on the reads object. Those keys are
left alone rather than orphaning a live reads file.

A failed delete raises. The rows naming these objects are the only record of
them and the next revision drops that record for good, so a revision that
recorded itself as applied after a transient storage error would strand the
survivors with nothing left to find them by. Raising keeps the revision pending
and the table intact; ``delete`` is idempotent, so a re-run picks up where this
one stopped.

Revision ID: kjjrlsltgsml
Date: 2026-08-06 19:17:12.678150

"""

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.storage.cleanup import delete_keys

logger = get_logger("migration")

# Revision identifiers.
name = "delete sample artifact objects"
created_at = arrow.get("2026-08-06 19:17:12.678150")
revision_id = "kjjrlsltgsml"

alembic_down_revision = None
virtool_down_revision = "8kt397kdecbe"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None

SWEEPABLE_KEYS = text(
    """
    SELECT storage_key
    FROM sample_artifacts
    WHERE storage_key IS NOT NULL
      AND storage_key NOT IN (
        SELECT storage_key FROM sample_reads WHERE storage_key IS NOT NULL
      )
    """,
)


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as session:
        keys = list((await session.execute(SWEEPABLE_KEYS)).scalars())

    if not keys:
        return

    logger.info("deleting sample artifact objects", count=len(keys))

    failures = await delete_keys(ctx.storage, keys)

    if failures:
        for key, failure in failures:
            logger.error(
                "could not delete sample artifact object",
                key=key,
                error=repr(failure),
            )

        raise RuntimeError(
            f"Could not delete {len(failures)} of {len(keys)} sample artifact "
            f"objects. The table is left in place so the sweep can be retried.",
        )
