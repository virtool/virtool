from zipfile import BadZipFile

from aiohttp import ClientSession
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.analyses.db import bump_analysis_updated_at
from virtool.analyses.utils import find_nuvs_sequence_by_index
from virtool.blast.db import delete_nuvs_blast, get_nuvs_blast
from virtool.blast.models import NuvsBlast
from virtool.blast.utils import (
    check_rid,
    extract_blast_info,
    fetch_ncbi_blast_html,
    fetch_nuvs_blast_result,
    format_blast_content,
)
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceNotFoundError


class BLASTData(DataLayerDomain):
    """A data layer piece for BLAST data."""

    name = "blast"

    def __init__(self, client: ClientSession, pg: AsyncEngine):
        self._client = client
        self._pg = pg

    async def initialize_on_ncbi(self, analysis_id: int, sequence_index: int):
        """Send a request to NCBI to BLAST the passed sequence.

        Return the RID and RTOE from the response.

        :param analysis_id: the id the nuvs analysis
        :param sequence_index: the index of the sequence
        :return: the RID and RTOE for the request
        """
        analysis = await self.data.analyses.get(analysis_id, None)

        sequence = find_nuvs_sequence_by_index(
            analysis.dict(by_alias=True)["results"], sequence_index
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

    async def get_nuvs_blast(self, analysis_id: int, sequence_index: int) -> NuvsBlast:
        """Get a NuVs BLAST record by its analysis ID and sequence index.

        :param analysis_id:
        :param sequence_index:
        :return: the dictionary representation of the BLAST record
        """
        async with AsyncSession(self._pg) as session:
            blast = await get_nuvs_blast(session, analysis_id, sequence_index)
            return NuvsBlast(**blast.to_dict())

    async def check_nuvs_blast(
        self,
        analysis_id: int,
        sequence_index: int,
    ):
        """Sync our BLAST resource with NCBI.

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

            if blast_row is None or blast_row.rid is None:
                raise ResourceNotFoundError

            rid = blast_row.rid

        ready = await check_rid(self._client, rid)

        result = None
        error = None

        if ready:
            try:
                result_json = await fetch_nuvs_blast_result(self._client, rid)
                result = format_blast_content(result_json)
            except BadZipFile:
                error = "Unable to interpret NCBI result"

        async with AsyncSession(self._pg) as session:
            blast_row = await get_nuvs_blast(session, analysis_id, sequence_index)

            if blast_row is None:
                raise ResourceNotFoundError

            blast_row.last_checked_at = updated_at
            blast_row.updated_at = updated_at

            if ready:
                if error:
                    blast_row.error = error
                else:
                    blast_row.result = result
                    blast_row.ready = True

            await bump_analysis_updated_at(session, analysis_id, updated_at)

            await session.commit()

        return await self.get_nuvs_blast(analysis_id, sequence_index)

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
