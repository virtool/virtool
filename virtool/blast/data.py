import asyncio
from datetime import datetime, timedelta
from zipfile import BadZipFile

from aiohttp import ClientSession
from sqlalchemy import Row, delete, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.utils
from virtool.analyses.db import bump_analysis_updated_at
from virtool.analyses.utils import find_nuvs_sequence_by_index
from virtool.blast.db import delete_nuvs_blast, get_nuvs_blast
from virtool.blast.models import NuvsBlast
from virtool.blast.sql import SQLNuVsBlast
from virtool.blast.utils import (
    check_rid,
    extract_blast_info,
    fetch_ncbi_blast_html,
    fetch_nuvs_blast_result,
    format_blast_content,
)
from virtool.data.domain import DataLayerDomain

logger = get_logger("blast")


INITIAL_INTERVAL = 3
"""The number of seconds to wait before the first status check of a search."""

INTERVAL_STEP = 5
"""The number of seconds added to a search's interval after each status check."""

MAX_INTERVAL = 75
"""The longest interval that may separate two status checks of a search."""

TIMEOUT = timedelta(minutes=30)
"""How long a search may remain unfinished before it is abandoned."""

MAX_CONCURRENT_CHECKS = 3
"""The number of searches whose status may be checked on NCBI at the same time."""

MAX_CONCURRENT_INITIALIZATIONS = 1
"""The number of searches that may be submitted to NCBI at the same time.

NCBI polices submission of new searches more closely than status checks, and the
former serial task runner only ever submitted one at a time.
"""


class BLASTData(DataLayerDomain):
    """A data layer piece for BLAST data."""

    name = "blast"

    def __init__(self, client: ClientSession, pg: AsyncEngine):
        self._client = client
        self._pg = pg

    async def sweep(self) -> None:
        """Advance every outstanding NuVs BLAST search by one step.

        A search is described entirely by its ``nuvs_blast`` row:

        * a row with no ``rid`` has not reached NCBI yet and is submitted;
        * a row with a ``rid`` has a search running on NCBI and is checked;
        * a row that is ``ready`` or carries an ``error`` is finished and ignored.

        Rows are only touched once their ``interval`` has elapsed since their
        ``last_checked_at``, which spaces out requests to NCBI on a per-search basis.
        Rows that have outlived :data:`TIMEOUT` are deleted.
        """
        now = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            rows = (
                await session.execute(
                    select(
                        SQLNuVsBlast.id,
                        SQLNuVsBlast.analysis_id,
                        SQLNuVsBlast.sequence_index,
                        SQLNuVsBlast.rid,
                        SQLNuVsBlast.interval,
                        SQLNuVsBlast.created_at,
                        SQLNuVsBlast.last_checked_at,
                    )
                    .where(SQLNuVsBlast.ready.is_(False))
                    .where(SQLNuVsBlast.error.is_(None)),
                )
            ).all()

        expired = [row for row in rows if now - row.created_at >= TIMEOUT]

        if expired:
            await self._delete_expired(expired, now)

        expired_ids = {row.id for row in expired}

        due = [
            row
            for row in rows
            if row.id not in expired_ids
            and now - row.last_checked_at
            >= timedelta(seconds=row.interval or INITIAL_INTERVAL)
        ]

        if not due:
            return

        initialization_semaphore = asyncio.Semaphore(MAX_CONCURRENT_INITIALIZATIONS)
        check_semaphore = asyncio.Semaphore(MAX_CONCURRENT_CHECKS)

        async def advance(row: Row) -> None:
            semaphore = check_semaphore if row.rid else initialization_semaphore

            async with semaphore:
                try:
                    if row.rid is None:
                        await self._initialize(row)
                    else:
                        await self._check(row)
                except Exception:
                    logger.exception("failed to advance blast", id=row.id, rid=row.rid)
                    await self._back_off(row)

        await asyncio.gather(*[advance(row) for row in due])

    async def _back_off(self, row: Row) -> None:
        """Delay the next attempt on a row whose advance failed against NCBI.

        A failed advance never reaches the database, so the row's ``interval`` and
        ``last_checked_at`` would otherwise stay untouched and the sweeper would retry
        it on the very next pass. Bump them with the same backoff the not-ready check
        uses so an NCBI outage spaces retries out instead of hammering NCBI.
        """
        timestamp = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            await session.execute(
                update(SQLNuVsBlast)
                .where(SQLNuVsBlast.id == row.id)
                .values(
                    last_checked_at=timestamp,
                    interval=min(
                        (row.interval or INITIAL_INTERVAL) + INTERVAL_STEP,
                        MAX_INTERVAL,
                    ),
                ),
            )
            await session.commit()

    async def _delete_expired(self, expired: list[Row], now: datetime) -> None:
        """Abandon searches that have outlived :data:`TIMEOUT`.

        Rows are deleted by primary key. A re-BLAST of the same sequence deletes and
        recreates the row, so deleting by analysis and sequence index could destroy a
        newer search that replaced the expired one.
        """
        async with AsyncSession(self._pg) as session:
            for row in expired:
                result = await session.execute(
                    delete(SQLNuVsBlast).where(SQLNuVsBlast.id == row.id),
                )

                if result.rowcount:
                    await bump_analysis_updated_at(session, row.analysis_id, now)
                    logger.info("deleted timed out blast", id=row.id, rid=row.rid)

            await session.commit()

    async def _initialize(self, row: Row) -> None:
        """Submit a search to NCBI and store the RID it returns.

        The RID is only stored if the row still has no RID of its own. A re-BLAST of
        the same sequence deletes and recreates the row, so a row that has gained a
        RID while we were talking to NCBI belongs to a newer search.
        """
        analysis = await self.data.analyses.get(row.analysis_id, None)

        sequence = find_nuvs_sequence_by_index(
            analysis.dict(by_alias=True)["results"],
            row.sequence_index,
        )

        html = await fetch_ncbi_blast_html(self._client, sequence)

        rid, _ = extract_blast_info(html)

        timestamp = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                update(SQLNuVsBlast)
                .where(SQLNuVsBlast.id == row.id, SQLNuVsBlast.rid.is_(None))
                .values(rid=rid, updated_at=timestamp, last_checked_at=timestamp),
            )

            if result.rowcount == 0:
                logger.info("discarded rid for superseded blast", id=row.id, rid=rid)
                return

            await bump_analysis_updated_at(session, row.analysis_id, timestamp)

            await session.commit()

        logger.info("started blast search", id=row.id, rid=rid)

    async def _check(self, row: Row) -> None:
        """Sync a search with NCBI, storing its result once it is ready.

        The row is only written if it still carries the RID we checked, so a result
        that arrives after a re-BLAST cannot land on the replacement row.
        """
        ready = await check_rid(self._client, row.rid)

        timestamp = virtool.utils.timestamp()

        values = {"last_checked_at": timestamp, "updated_at": timestamp}

        if not ready:
            values["interval"] = min(
                (row.interval or INITIAL_INTERVAL) + INTERVAL_STEP,
                MAX_INTERVAL,
            )
        else:
            try:
                result = await fetch_nuvs_blast_result(self._client, row.rid)
            except BadZipFile:
                values["error"] = "Unable to interpret NCBI result"
            else:
                values["ready"] = True
                values["result"] = format_blast_content(result)

        async with AsyncSession(self._pg) as session:
            update_result = await session.execute(
                update(SQLNuVsBlast)
                .where(SQLNuVsBlast.id == row.id, SQLNuVsBlast.rid == row.rid)
                .values(**values),
            )

            if update_result.rowcount == 0:
                logger.info(
                    "discarded result for superseded blast",
                    id=row.id,
                    rid=row.rid,
                )
                return

            await bump_analysis_updated_at(session, row.analysis_id, timestamp)

            await session.commit()

        if "error" in values:
            logger.warning(
                "could not interpret blast result",
                id=row.id,
                rid=row.rid,
                error=values["error"],
            )
        elif ready:
            logger.info("retrieved result for blast", id=row.id, rid=row.rid)

    async def get_nuvs_blast(self, analysis_id: int, sequence_index: int) -> NuvsBlast:
        """Get a NuVs BLAST record by its analysis ID and sequence index.

        :param analysis_id:
        :param sequence_index:
        :return: the dictionary representation of the BLAST record
        """
        async with AsyncSession(self._pg) as session:
            blast = await get_nuvs_blast(session, analysis_id, sequence_index)
            return NuvsBlast(**blast.to_dict())

    async def delete_nuvs_blast(self, analysis_id: int, sequence_index: int) -> int:
        """Remove a NuVs BLAST record.

        :param analysis_id: the analysis the BLAST belongs to
        :param sequence_index: the index of the BLASTed NuVs sequence
        :return: the number of deleted records
        """
        updated_at = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            deleted_count = await delete_nuvs_blast(
                session, analysis_id, sequence_index
            )

            await bump_analysis_updated_at(session, analysis_id, updated_at)

            await session.commit()

        return deleted_count
