from typing import List, TYPE_CHECKING
from zipfile import BadZipFile

from aiohttp import ClientSession
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.blast import NuvsBlast

import virtool.utils
from virtool.analyses.utils import find_nuvs_sequence_by_index
from virtool.blast.db import get_nuvs_blast, delete_nuvs_blast
from virtool.blast.models import SQLNuVsBlast
from virtool.blast.task import BLASTTask
from virtool.blast.utils import (
    extract_blast_info,
    fetch_ncbi_blast_html,
    check_rid,
)
from virtool.blast.utils import format_blast_content, fetch_nuvs_blast_result
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceNotFoundError
from virtool.types import Document

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


class BLASTData(DataLayerDomain):
    """
    A data layer piece for BLAST data.
    """

    name = "blast"

    def __init__(self, client: ClientSession, mongo: "Mongo", pg: AsyncEngine):
        self._client = client
        self._mongo = mongo
        self._pg = pg

    async def create_nuvs_blast(
        self, analysis_id: str, sequence_index: int
    ) -> NuvsBlast:
        """
        Create a NuVs BLAST record for the sequence associated with a specific analysis
        ID and sequence index.

        A task will be spawned that runs a BLAST search against NCBI and populates the
        database with result. The analysis and BLAST records are updated as the task
        proceeds.

        :param analysis_id: the ID for the analysis to create BLAST for
        :param sequence_index: the index of the sequence being BLASTed.
        :return: the dictionary representation of the BLAST record.
        """
        created_at = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            await delete_nuvs_blast(session, analysis_id, sequence_index)
            await session.flush()

            blast_row = SQLNuVsBlast(
                analysis_id=analysis_id,
                created_at=created_at,
                last_checked_at=created_at,
                ready=False,
                sequence_index=sequence_index,
                updated_at=created_at,
            )

            session.add(blast_row)
            await session.flush()

            await self.data.tasks.create(
                BLASTTask,
                {"analysis_id": analysis_id, "sequence_index": sequence_index},
            )

            blast = NuvsBlast(**blast_row.to_dict())

            # Don't commit until the task has been created.
            await session.commit()

        await self._mongo.analyses.update_one(
            {"_id": analysis_id}, {"$set": {"updated_at": created_at}}
        )

        return blast

    async def initialize_on_ncbi(self, analysis_id: str, sequence_index: int):
        """
        Send a request to NCBI to BLAST the passed sequence.

        Return the RID and RTOE from the response.

        :param analysis_id: the id the nuvs analysis
        :param sequence_index: the index of the sequence
        :return: the RID and RTOE for the request
        """
        analysis = await self.data.analyses.get(analysis_id, None)

        sequence = find_nuvs_sequence_by_index(
            analysis.dict(by_alias=True), sequence_index
        )

        html = await fetch_ncbi_blast_html(self._client, sequence)

        rid, _ = extract_blast_info(html)

        async with AsyncSession(self._pg) as session:
            blast_row = await get_nuvs_blast(session, analysis_id, sequence_index)

            if blast_row is None:
                raise ResourceNotFoundError

            blast_row.rid = rid

            blast = NuvsBlast(**blast_row.to_dict())

            await session.commit()

        return blast

    async def get_nuvs_blast(self, analysis_id: str, sequence_index: int) -> NuvsBlast:
        """
        Get a NuVs BLAST record by its analysis ID and sequence index.

        :param analysis_id:
        :param sequence_index:
        :return: the dictionary representation of the BLAST record
        """
        async with AsyncSession(self._pg) as session:
            blast = await get_nuvs_blast(session, analysis_id, sequence_index)
            return NuvsBlast(**blast.to_dict())

    async def check_nuvs_blast(
        self,
        analysis_id: str,
        sequence_index: int,
    ):
        """
        Sync our BLAST resource with NCBI.

        Send a request to NCBI to check on the status of a BLAST request. Update the
        ``last_checked_at`` field.

        If the BLAST result is ready:

        1. Set the `ready` field to `true`.
        2. Download the result and set the JSON as the value of the `result` field.

        If an error is encountered while parsing the result, the `error` field is set.

        """
        updated_at = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            blast_row = await get_nuvs_blast(session, analysis_id, sequence_index)

            if blast_row is None:
                raise ResourceNotFoundError

            ready = await check_rid(self._client, blast_row.rid)

            blast_row.last_checked_at = updated_at
            blast_row.updated_at = updated_at

            if ready:
                try:
                    result_json = await fetch_nuvs_blast_result(
                        self._client, blast_row.rid
                    )

                    blast_row.result = format_blast_content(result_json)
                    blast_row.ready = True
                except BadZipFile:
                    blast_row.error = "Unable to interpret NCBI result"

                await session.flush()

            await session.commit()

        await self._mongo.analyses.update_one(
            {"_id": analysis_id},
            {"$set": {"updated_at": updated_at}},
        )

        return await self.get_nuvs_blast(analysis_id, sequence_index)

    async def delete_nuvs_blast(self, analysis_id: str, sequence_index: int) -> int:
        """
        Remove a NuVs BLAST record.

        :param analysis_id: the analysis the BLAST belongs to
        :param sequence_index: the index of the BLASTed NuVs sequence
        :return: the number of deleted records
        """
        async with AsyncSession(self._pg) as session:
            deleted_count = await delete_nuvs_blast(
                session, analysis_id, sequence_index
            )
            await session.commit()

        await self._mongo.analyses.update_one(
            {"_id": analysis_id}, {"$set": {"updated_at": virtool.utils.timestamp()}}
        )

        return deleted_count

    async def list_by_analysis(self, analysis_id: str) -> List[Document]:
        """
        Get all BLAST records associated with an analysis.

        :param analysis_id: the ID of the analysis to list BLASTs for
        :return: a list of BLAST records
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLNuVsBlast).where(SQLNuVsBlast.analysis_id == analysis_id)
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
