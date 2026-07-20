"""Migration logic for keying ``legacy_history`` by an integer index foreign key.

Holds the idempotent backfill that promotes the legacy Mongo ``index`` string to the
``index_id`` foreign key. Keeping it here rather than in the revision file keeps the
logic unit-testable and reusable.
"""

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.history.sql import SQLLegacyHistory
from virtool.indexes.sql import SQLIndex
from virtool.migration import MigrationContext

logger = get_logger("migration")


async def backfill_history_index_ids(ctx: MigrationContext) -> None:
    """Backfill ``legacy_history.index_id`` from the legacy ``index`` string.

    Each built change carries an ``index`` string equal to the Mongo ``_id`` of the
    index it belongs to, which the ``indexes`` table holds as ``legacy_id``. This
    resolves every such string to the integer primary key and writes it to
    ``index_id`` in a single set-based ``UPDATE ... FROM``.

    A ``NULL`` ``index`` is the deliberate "unbuilt" sentinel: the change is not yet in
    any build. Those rows are left with a ``NULL`` ``index_id``, which means exactly the
    same thing, and are never treated as an error.

    The backfill is idempotent: it only touches rows whose ``index_id`` is still
    ``NULL``, so a re-run after an interruption resolves the remainder and re-running a
    completed backfill is a no-op.

    After the update, any row that still has a non-null ``index`` but a ``NULL``
    ``index_id`` is an unresolvable index string -- an ``indexes`` row is missing for a
    built change -- and raises. This tripwire fires only on genuinely unresolvable
    strings, never on the common unbuilt (``index IS NULL``) case.
    """
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            update(SQLLegacyHistory)
            .where(
                SQLLegacyHistory.index.isnot(None),
                SQLLegacyHistory.index_id.is_(None),
                SQLLegacyHistory.index == SQLIndex.legacy_id,
            )
            .values(index_id=SQLIndex.id),
        )
        await session.commit()

        logger.info("backfilled history index ids", updated=result.rowcount)

        unresolved = await session.scalar(
            select(func.count())
            .select_from(SQLLegacyHistory)
            .where(
                SQLLegacyHistory.index.isnot(None),
                SQLLegacyHistory.index_id.is_(None),
            ),
        )

    if unresolved:
        msg = (
            f"{unresolved} legacy_history rows have a non-null index that does not "
            "resolve to an indexes row"
        )
        raise ValueError(msg)
