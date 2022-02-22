from datetime import datetime
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.blast.models import NuVsBlast
from virtool.blast.task import BLASTTask
from virtool.tasks.client import TasksClient
from virtool.types import Document


class BLASTData:
    """
    A data layer domain for NuVs BLAST data.
    """

    def __init__(self, db, pg: AsyncEngine, tasks: TasksClient):
        self._db = db
        self._pg = pg
        self._tasks = tasks

    async def create_nuvs_blast(
        self, analysis_id: str, sequence_index: int
    ) -> Document:
        """
        Create a NuVs BLAST record for the sequence associated with a specific analysis
        ID and sequence index.

        A BLAST task will be spawned that runs a BLAST search against NCBI and
        populates the database with result. The analysis and BLAST records are
        updated as the task proceeds.

        :param analysis_id: the ID for the analysis to create BLAST for
        :param sequence_index: the index of the sequence being BLASTed.
        :return: the dictionary representation of the BLAST record.
        """
        timestamp = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            await self._remove_nuvs_blast(session, analysis_id, sequence_index)
            await session.flush()

            blast = NuVsBlast(
                analysis_id=analysis_id,
                created_at=timestamp,
                last_checked_at=timestamp,
                ready=False,
                sequence_index=sequence_index,
                updated_at=timestamp,
            )

            session.add(blast)
            await session.flush()

            await self._tasks.add(
                BLASTTask,
                {"analysis_id": analysis_id, "sequence_index": sequence_index},
            )

            blast_data = blast.to_dict()
            await session.commit()

        return blast_data

    @staticmethod
    async def _get_nuvs_blast(session, analysis_id: str, sequence_index: int):
        result = await session.execute(
            select(NuVsBlast)
            .filter(NuVsBlast.analysis_id == analysis_id)
            .filter(NuVsBlast.sequence_index == sequence_index)
        )

        return result.scalar_one()

    async def get_nuvs_blast(self, analysis_id: str, sequence_index: int) -> Document:
        """
        Get a NuVs BLAST record by its analysis ID and sequence index.

        :param analysis_id:
        :param sequence_index:
        :return: the dictionary representation of the BLAST record
        """
        async with AsyncSession(self._pg) as session:
            return await self._get_nuvs_blast(session, analysis_id, sequence_index)

    async def update_nuvs_blast(
        self,
        analysis_id: str,
        sequence_index: int,
        error: Optional[str],
        last_checked_at: Optional[datetime],
        rid: Optional[str],
        ready: bool,
        result: Optional[dict],
    ) -> Document:
        """
        Update an existing NuVsBlast as it progresses in Virtool and on NCBI.

        Returns a `dict` representation of the BLAST record.

        :param analysis_id: the ID of the NuVs analysis
        :param sequence_index: the index of the NuVs nucleotide sequence
        :param error: an optional error string
        :param last_checked_at: when the NCBI API was last checked for results
        :param rid: the NCBI ID for the BLAST request
        :param ready: whether the NCBI BLAST search has completed
        :param result: the BLAST search result from NCBI
        :return: the dictionary representation of the BLAST search
        """
        timestamp = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            blast = await self._get_nuvs_blast(session, analysis_id, sequence_index)

            blast.updated_at = timestamp
            blast.error = error
            blast.last_checked_at = last_checked_at
            blast.rid = rid
            blast.ready = ready
            blast.result = result

            session.add(blast)
            await session.flush()
            document = blast.to_dict()
            await session.commit()

        await self._db.analyses.update_one(
            {"_id": analysis_id}, {"$set": {"updated_at": virtool.utils.timestamp()}}
        )

        return document

    async def _remove_nuvs_blast(
        self, session: AsyncSession, analysis_id: str, sequence_index: int
    ) -> int:
        result = await session.execute(
            delete(NuVsBlast)
            .where(NuVsBlast.analysis_id == analysis_id)
            .where(NuVsBlast.sequence_index == sequence_index)
        )
        await session.commit()

        await self._db.analyses.update_one(
            {"_id": analysis_id}, {"$set": {"updated_at": virtool.utils.timestamp()}}
        )

        return result.rowcount

    async def remove_nuvs_blast(self, analysis_id: str, sequence_index: int) -> int:
        """
        Remove a NuVs BLAST record.

        :param analysis_id: the analysis the BLAST belongs to
        :param sequence_index: the index of the BLASTed NuVs sequence
        :return: the number of deleted records
        """
        async with AsyncSession(self._pg) as session:
            return await self._remove_nuvs_blast(session, analysis_id, sequence_index)

    async def list_by_analysis(self, analysis_id: str) -> List[Document]:
        """
        Get all BLAST records associated with an analysis.

        :param analysis_id: the ID of the analysis to list BLASTs for
        :return: a list of BLAST records
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(NuVsBlast).where(NuVsBlast.analysis_id == analysis_id)
            )

            return [
                {
                    "id": blast.id,
                    "created_at": blast.created_at,
                    "updated_at": blast.updated_at,
                    "last_checked_at": blast.last_checked_at,
                    "interval": blast.interval,
                    "rid": blast.rid,
                    "ready": blast.ready,
                    "result": blast.result,
                }
                for blast in result.scalars()
            ]
