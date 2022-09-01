from asyncio import gather, CancelledError
from datetime import datetime
from logging import getLogger
from typing import Union, Tuple, Dict, Optional

from multidict import MultiDictProxy
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.analysis import AnalysisSearchResult, Analysis
from virtool_core.utils import rm

import virtool.analyses.format
import virtool.samples.db
import virtool.uploads.db
from virtool.analyses.db import PROJECTION, processor
from virtool.analyses.files import create_analysis_file
from virtool.analyses.models import AnalysisFile
from virtool.analyses.utils import attach_analysis_files, find_nuvs_sequence_by_index
from virtool.api.utils import paginate
from virtool.blast.models import NuVsBlast
from virtool.blast.task import BLASTTask
from virtool.blast.transform import AttachNuVsBLAST
from virtool.data.errors import (
    ResourceNotFoundError,
    ResourceNotModifiedError,
    ResourceError,
    ResourceConflictError,
)
from virtool.mongo.core import DB
from virtool.mongo.transforms import apply_transforms
from virtool.mongo.utils import get_one_field
from virtool.pg.utils import delete_row, get_row_by_id
from virtool.samples.db import recalculate_workflow_tags
from virtool.samples.utils import get_sample_rights
from virtool.subtractions.db import AttachSubtractionTransform
from virtool.tasks.client import TasksClient
from virtool.uploads.utils import naive_writer
from virtool.users.db import AttachUserTransform
from virtool.utils import run_in_thread

logger = getLogger("analyses")


class AnalysisData:
    def __init__(self, db: DB, config, pg: AsyncEngine, tasks: TasksClient):
        self._db = db
        self._config = config
        self._pg = pg
        self._tasks = tasks

    async def find(
        self, query: Union[Dict, MultiDictProxy[str]], client
    ) -> AnalysisSearchResult:
        """
        List all analysis documents.

        :param query: the request query
        :param client: the client object
        :return: a list of all analysis documents
        """
        db_query = {}

        data = await paginate(
            self._db.analyses,
            db_query,
            query,
            projection=PROJECTION,
            sort=[("created_at", -1)],
        )

        per_document_can_read = await gather(
            *[
                virtool.samples.db.check_rights(
                    self._db, document["sample"]["id"], client, write=False
                )
                for document in data["documents"]
            ]
        )

        documents = [
            document
            for document, can_write in zip(data["documents"], per_document_can_read)
            if can_write
        ]

        documents = await apply_transforms(
            documents,
            [AttachUserTransform(self._db), AttachSubtractionTransform(self._db)],
        )

        data["documents"] = documents

        return AnalysisSearchResult(**data)

    async def get(
        self, analysis_id: str, if_modified_since: Optional[datetime]
    ) -> Analysis:
        """
        Get a single analysis by its ID.

        :param analysis_id: the analysis ID
        :param if_modified_since: the date the document should have been last modified
        :return: the analysis
        """
        document = await self._db.analyses.find_one(analysis_id)

        if document is None:
            raise ResourceNotFoundError()

        if if_modified_since is not None:
            try:
                updated_at = document["updated_at"]
            except KeyError:
                updated_at = document["created_at"]

            if if_modified_since == updated_at:
                raise ResourceNotModifiedError()

        document = await attach_analysis_files(self._pg, analysis_id, document)

        document_before_formatting = document

        sample = await self._db.samples.find_one(
            {"_id": document["sample"]["id"]}, {"quality": False}
        )

        if not sample:
            raise ResourceError()

        if document["ready"]:
            document = await virtool.analyses.format.format_analysis(
                self._config, self._db, document
            )

        document = await processor(self._db, document)

        if document["workflow"] == "nuvs":
            document = await apply_transforms(
                document,
                [AttachNuVsBLAST(self._pg)],
            )

        for key in document_before_formatting:
            if key not in document:
                document.update({key: document_before_formatting[key]})

        return Analysis(**document)

    async def has_right(self, analysis_id: str, client, right: str) -> bool:
        """
        Checks if the client has the `read` or `write` rights.

        :param analysis_id: the analysis ID
        :param client: the client object
        :param right: the right to check for
        :return: boolean value
        """
        sample = await get_one_field(self._db.analyses, "sample", analysis_id)

        if sample is None:
            raise ResourceNotFoundError()

        sample = await self._db.samples.find_one(
            {"_id": sample["id"]},
            ["user", "group", "all_read", "group_read", "group_write", "all_write"],
        )

        if not sample:
            raise ResourceError()

        read, write = get_sample_rights(sample, client)

        if right == "read":
            return read

        if right == "write":
            return write

    async def delete(self, analysis_id: str, jobs_api_flag: bool):
        """
        Delete a single analysis by its ID.

        :param analysis_id: the analysis ID
        :param jobs_api_flag: checks if the jobs_api is handling the request
        """
        document = await self._db.analyses.find_one(
            {"_id": analysis_id}, ["job", "ready", "sample"]
        )

        if not document:
            raise ResourceNotFoundError()

        sample_id = document["sample"]["id"]

        if jobs_api_flag:
            if document["ready"]:
                raise ResourceConflictError()
        else:
            if not document["ready"]:
                raise ResourceConflictError()

        await self._db.analyses.delete_one({"_id": analysis_id})

        path = self._config.data_path / "samples" / sample_id / "analysis" / analysis_id

        try:
            await run_in_thread(rm, path, True)
        except FileNotFoundError:
            pass

        await recalculate_workflow_tags(self._db, sample_id)

    async def upload_file(
        self, reader, analysis_id: str, analysis_format: str, name: str
    ) -> Optional[AnalysisFile]:
        """
        Uploads a new analysis result file.

        :param reader: the file reader
        :param analysis_id: the analysis ID
        :param analysis_format: the format of the analysis
        :param name: the name of the analysis file
        :return: the new analysis file
        """

        document = await self._db.analyses.find_one(analysis_id)

        if document is None:
            raise ResourceNotFoundError()

        analysis_file = await create_analysis_file(
            self._pg, analysis_id, analysis_format, name
        )

        upload_id = analysis_file["id"]

        analysis_file_path = (
            self._config.data_path / "analyses" / analysis_file["name_on_disk"]
        )

        try:
            size = await naive_writer(reader, analysis_file_path)
        except CancelledError:
            logger.debug(f"Analysis file upload aborted: {upload_id}")
            await delete_row(self._pg, upload_id, AnalysisFile)

            return None

        analysis_file = await virtool.uploads.db.finalize(
            self._pg, size, upload_id, AnalysisFile
        )

        return AnalysisFile(**analysis_file)

    async def get_file_name(self, upload_id: int) -> str:
        """
        Get a file generated during the analysis.

        :param upload_id: the upload ID
        :return: the name on disk of the analysis file
        """

        analysis_file = await get_row_by_id(self._pg, AnalysisFile, upload_id)

        if analysis_file:
            return analysis_file.name_on_disk

        raise ResourceNotFoundError()

    async def download(self, analysis_id: str, extension: str) -> Tuple[str, str]:
        """
        Get an analysis to be downloaded in CSV or XSLX format.

        :param analysis_id: the analysis ID
        :param extension: the file extension
        :return: formatted file and file content type
        """
        document = await self._db.analyses.find_one(analysis_id)

        if not document:
            raise ResourceNotFoundError()

        if extension == "xlsx":
            return (
                await virtool.analyses.format.format_analysis_to_excel(
                    self._config, self._db, document
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

        return (
            await virtool.analyses.format.format_analysis_to_csv(
                self._config, self._db, document
            ),
            "text/csv",
        )

    async def blast(self, analysis_id: str, sequence_index: int) -> Optional[str]:
        """
        BLAST a contig sequence that is part of a NuVs result record.

        :param analysis_id: the analysis ID
        :param sequence_index: the sequence index
        :return: the nuvs sequence
        """
        document = await self._db.analyses.find_one(
            {"_id": analysis_id}, ["ready", "workflow", "results", "sample"]
        )

        if document["workflow"] != "nuvs":
            raise ResourceConflictError("Not a NuVs analysis")

        if not document["ready"]:
            raise ResourceConflictError("Analysis is still running")

        sequence = find_nuvs_sequence_by_index(document, sequence_index)

        if sequence is None:
            raise ResourceNotFoundError()

        timestamp = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            await session.execute(
                delete(NuVsBlast)
                .where(NuVsBlast.analysis_id == analysis_id)
                .where(NuVsBlast.sequence_index == sequence_index)
            )
            await session.commit()

            await self._db.analyses.update_one(
                {"_id": analysis_id},
                {"$set": {"updated_at": virtool.utils.timestamp()}},
            )

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

    async def finalize(self, analysis_id: str, results: dict) -> Analysis:
        """
        Sets the result for an analysis and marks it as ready.

        :param analysis_id: the analysis ID
        :param results: the analysis results
        :return: the processed analysis document
        """

        analysis_document = await self._db.analyses.find_one(
            {"_id": analysis_id}, ["ready"]
        )

        if not analysis_document:
            raise ResourceNotFoundError()

        if "ready" in analysis_document and analysis_document["ready"]:
            raise ResourceConflictError

        document = await self._db.analyses.find_one_and_update(
            {"_id": analysis_id}, {"$set": {"results": results, "ready": True}}
        )

        await recalculate_workflow_tags(self._db, document["sample"]["id"])
        await attach_analysis_files(self._pg, analysis_id, document)

        document = await processor(self._db, document)

        return Analysis(**document)
