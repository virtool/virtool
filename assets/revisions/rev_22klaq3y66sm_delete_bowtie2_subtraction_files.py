"""delete bowtie2 subtraction files

Subtractions no longer carry a Bowtie2 index. The create-subtraction workflow
stopped building one, and no workflow downloads the ``.bt2`` files any more, so
the six ``bowtie2`` rows every older subtraction owns name objects that nothing
reads.

The objects are deleted before the rows because the rows are the only record of
them: a revision that dropped the rows first and then failed mid-sweep would
leave the survivors unreachable. A failed delete raises for the same reason,
which keeps the revision pending; ``delete`` is idempotent, so a re-run picks up
where this one stopped.

The ``fasta`` rows and their objects are left alone.

Revision ID: 22klaq3y66sm
Date: 2026-08-12 16:51:41.445075

"""

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.storage.cleanup import delete_keys

logger = get_logger("migration")

# Revision identifiers.
name = "delete bowtie2 subtraction files"
created_at = arrow.get("2026-08-12 16:51:41.445075")
revision_id = "22klaq3y66sm"

alembic_down_revision = "b253add43d69"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None

BOWTIE2_KEYS = text(
    """
    SELECT storage_key
    FROM subtraction_files
    WHERE type = 'bowtie2' AND storage_key IS NOT NULL
    """,
)

DELETE_BOWTIE2_ROWS = text("DELETE FROM subtraction_files WHERE type = 'bowtie2'")


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as session:
        keys = list((await session.execute(BOWTIE2_KEYS)).scalars())

    if keys:
        logger.info("deleting bowtie2 subtraction objects", count=len(keys))

        failures = await delete_keys(ctx.storage, keys)

        if failures:
            for key, failure in failures:
                logger.error(
                    "could not delete bowtie2 subtraction object",
                    key=key,
                    error=repr(failure),
                )

            raise RuntimeError(
                f"Could not delete {len(failures)} of {len(keys)} bowtie2 "
                f"subtraction objects. The rows are left in place so the sweep "
                f"can be retried.",
            )

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(DELETE_BOWTIE2_ROWS)
        await session.commit()

    logger.info("deleted bowtie2 subtraction file rows", count=result.rowcount)
