import asyncio
import math
from datetime import datetime

import sentry_sdk
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger
from virtool_core.models.analysis import Analysis, AnalysisFile, AnalysisSearchResult
from virtool_core.utils import rm

import virtool.analyses.format
import virtool.uploads.db
from virtool.analyses.checks import (
    check_analysis_nuvs_sequence,
    check_if_analysis_is_nuvs,
    check_if_analysis_is_running,
    check_if_analysis_modified,
)
from virtool.analyses.db import filter_analyses_by_sample_rights
from virtool.analyses.files import create_analysis_file
from virtool.analyses.models import SQLAnalysisFile, SQLAnalysisResult
from virtool.analyses.utils import (
    attach_analysis_files,
)
from virtool.blast.models import SQLNuVsBlast
from virtool.blast.task import BLASTTask
from virtool.blast.transform import AttachNuVsBLAST
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import both_transactions
from virtool.data.transforms import apply_transforms
from virtool.indexes.db import get_current_id_and_version
from virtool.jobs.transforms import AttachJobTransform
from virtool.ml.transforms import AttachMLTransform
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_new_id, get_one_field
from virtool.pg.utils import delete_row, get_row_by_id
from virtool.references.transforms import AttachReferenceTransform
from virtool.samples.db import recalculate_workflow_tags
from virtool.samples.oas import CreateAnalysisRequest
from virtool.samples.utils import get_sample_rights
from virtool.subtractions.db import (
    AttachSubtractionsTransform,
)
from virtool.uploads.utils import naive_writer
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor, wait_for_checks

logger = get_logger("analyses")


class AnalysisData(DataLayerDomain):
    name = "analyses"

    def __init__(self, mongo: Mongo, config, pg: AsyncEngine):
        self._config = config
        self._mongo = mongo
        self._pg = pg

    async def find(
        self,
        page: int,
        per_page: int,
        client,
        sample_id: str = None,
    ) -> AnalysisSearchResult:
        """List all analysis documents.

        :param page: the page number
        :param per_page: the number of documents per page
        :param client: the client object
        :param sample_id: sample id to search by
        :return: a list of all analysis documents
        """
        sort = {"created_at": -1}

        skip_count = 0

        if page > 1:
            skip_count = (page - 1) * per_page

        pipeline = [
            {"$match": {"sample.id": sample_id} if sample_id is not None else {}},
            {
                "$facet": {
                    "total_count": [{"$count": "total_count"}],
                    "data": [
                        {"$sort": sort},
                        {"$skip": skip_count},
                        {"$limit": per_page},
                    ],
                },
            },
            {
                "$project": {
                    "data": {
                        "_id": True,
                        "created_at": True,
                        "index": True,
                        "job": True,
                        "ml": True,
                        "ready": True,
                        "reference": True,
                        "sample": True,
                        "subtractions": True,
                        "updated_at": True,
                        "user": True,
                        "workflow": True,
                    },
                    "total_count": {"$arrayElemAt": ["$total_count.total_count", 0]},
                },
            },
        ]

        data: tuple[list[dict], int] | None = None

        with sentry_sdk.start_span(op="mongo", name="aggregate_find_analyses"):
            async for paginate_dict in self._mongo.analyses.aggregate(pipeline):
                data = (
                    paginate_dict["data"],
                    paginate_dict.get("total_count", 0),
                )
                break

        if data is None:
            raise ValueError("No data returned in aggregation")

        documents, total_count = data

        documents = await filter_analyses_by_sample_rights(
            client,
            self._mongo,
            documents,
        )

        documents = await apply_transforms(
            [base_processor(d) for d in documents],
            [
                AttachMLTransform(self._pg),
                AttachJobTransform(self._mongo),
                AttachReferenceTransform(self._mongo),
                AttachSubtractionsTransform(self._mongo),
                AttachUserTransform(self._mongo),
            ],
        )

        return AnalysisSearchResult.parse_obj(
            {
                "documents": documents,
                "found_count": total_count,
                "total_count": total_count,
                "page": page,
                "page_count": int(math.ceil(total_count / per_page)),
                "per_page": per_page,
            },
        )

    async def get(
        self,
        analysis_id: str,
        if_modified_since: datetime | None,
    ) -> Analysis:
        """Get a single analysis by its ID.

        :param analysis_id: the analysis ID
        :param if_modified_since: the date the document should have been last modified
        :return: the analysis
        """
        document = await self._mongo.analyses.find_one({"_id": analysis_id})

        if not document:
            raise ResourceNotFoundError()

        await wait_for_checks(check_if_analysis_modified(if_modified_since, document))

        document = await attach_analysis_files(self._pg, analysis_id, document)

        if document["ready"]:
            if document["results"] == "sql":
                async with AsyncSession(self._pg) as session:
                    result = await session.execute(
                        select(SQLAnalysisResult.results).where(
                            SQLAnalysisResult.analysis_id == analysis_id,
                        ),
                    )

                    document["results"] = result.scalars().one()

            analysis = await virtool.analyses.format.format_analysis(
                self._config,
                self._mongo,
                document,
            )

        transforms = [
            AttachJobTransform(self._mongo),
            AttachMLTransform(self._pg),
            AttachReferenceTransform(self._mongo),
            AttachSubtractionsTransform(self._mongo),
            AttachUserTransform(self._mongo),
        ]

        if document["workflow"] == "nuvs":
            transforms.append(AttachNuVsBLAST(self._pg))

        document = await apply_transforms(base_processor(document), transforms)

        return Analysis.parse_obj(
            {**document, "job": document["job"] if document["job"] else None},
        )

    @emits(Operation.CREATE, "analyses")
    async def create(
        self,
        data: CreateAnalysisRequest,
        sample_id: str,
        user_id: str,
        space_id: int,
    ) -> Analysis:
        """Creates a new analysis.

        Ensures that a valid subtraction host was the submitted. Configures read and
        write permissions on the sample document and assigns it a creator username
        based on the requesting connection.

        :param data: the analysis creation input data
        :param sample_id: the ID of the sample to create an analysis for
        :param user_id: the ID of the user starting the job
        :param space_id: the ID of the parent space
        :return: the analysis

        """
        created_at = virtool.utils.timestamp()

        (
            (index_id, index_version),
            sample_name,
        ) = await asyncio.gather(
            get_current_id_and_version(self._mongo, data.ref_id),
            get_one_field(self._mongo.samples, "name", sample_id),
        )

        analysis_id = await get_new_id(self._mongo.analyses)
        job_id = await get_new_id(self._mongo.jobs)

        await self._mongo.analyses.insert_one(
            {
                "_id": analysis_id,
                "created_at": created_at,
                "files": [],
                "index": {"id": index_id, "version": index_version},
                "job": {"id": job_id},
                "ml": data.ml,
                "reference": {
                    "id": data.ref_id,
                },
                "ready": False,
                "results": None,
                "sample": {"id": sample_id},
                "space": {"id": space_id},
                "subtractions": data.subtractions,
                "updated_at": created_at,
                "user": {
                    "id": user_id,
                },
                "workflow": data.workflow.value,
            },
        )

        await self.data.jobs.create(
            data.workflow.value,
            {
                "analysis_id": analysis_id,
                "ref_id": data.ref_id,
                "sample_id": sample_id,
                "sample_name": sample_name,
                "index_id": index_id,
                "subtractions": data.subtractions,
            },
            user_id,
            space_id,
            job_id,
        )

        return await self.get(analysis_id, None)

    async def has_right(self, analysis_id: str, client, right: str) -> bool:
        """Checks if the client has the `read` or `write` rights.

        :param analysis_id: the analysis ID
        :param client: the client object
        :param right: the right to check for
        :return: boolean value
        """
        sample = await get_one_field(self._mongo.analyses, "sample", analysis_id)

        if sample is None:
            raise ResourceNotFoundError

        sample_id = sample["id"]

        sample = await self._mongo.samples.find_one(
            {"_id": sample_id},
            ["user", "group", "all_read", "group_read", "group_write", "all_write"],
        )

        if not sample:
            logger.warning(
                "parent sample not found for analysis",
                analysis_id=analysis_id,
                sample_id=sample_id,
            )
            raise ResourceNotFoundError

        read, write = get_sample_rights(sample, client)

        if right == "read":
            return read

        if right == "write":
            return write

    async def delete(self, analysis_id: str, jobs_api_flag: bool):
        """Delete a single analysis by its ID.

        :param analysis_id: the analysis ID
        :param jobs_api_flag: checks if the jobs_api is handling the request
        """
        analysis = await self.get(analysis_id, None)

        if not analysis:
            raise ResourceNotFoundError

        if not analysis.ready and not jobs_api_flag:
            # Only the jobs API is allowed to delete incomplete analyses.
            raise ResourceConflictError

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await asyncio.gather(
                self._mongo.analyses.delete_one({"_id": analysis.id}),
                pg_session.execute(
                    delete(SQLAnalysisResult).where(
                        SQLAnalysisResult.analysis_id == analysis_id,
                    ),
                ),
            )

        try:
            await asyncio.to_thread(
                rm,
                self._config.data_path
                / "samples"
                / analysis.sample.id
                / "analysis"
                / analysis_id,
                True,
            )
        except FileNotFoundError:
            pass

        await recalculate_workflow_tags(self._mongo, analysis.sample.id)

        emit(
            await self.data.samples.get(analysis.sample.id),
            "samples",
            "recalculate_workflow_tags",
            Operation.UPDATE,
        )
        emit(analysis, "analyses", "delete", Operation.DELETE)

    async def upload_file(
        self,
        chunks,
        analysis_id: str,
        analysis_format: str,
        name: str,
    ) -> AnalysisFile | None:
        """Uploads a new analysis result file.

        :param chunks: a chunker that yields chunks of data
        :param analysis_id: the analysis ID
        :param analysis_format: the format of the analysis
        :param name: the name of the analysis file
        :return: the new analysis file
        """
        document = await self._mongo.analyses.find_one(analysis_id)

        if document is None:
            raise ResourceNotFoundError

        analysis_file = await create_analysis_file(
            self._pg,
            analysis_id,
            analysis_format,
            name,
        )

        upload_id = analysis_file["id"]

        try:
            size = await naive_writer(
                chunks,
                self._config.data_path / "analyses" / analysis_file["name_on_disk"],
            )
        except asyncio.CancelledError:
            logger.info("analysis file upload aborted", upload_id=upload_id)
            await delete_row(self._pg, upload_id, SQLAnalysisFile)
            return None

        analysis_file = await virtool.uploads.db.finalize(
            self._pg,
            size,
            upload_id,
            SQLAnalysisFile,
        )

        return AnalysisFile(**analysis_file)

    async def get_file_name(self, upload_id: int) -> str:
        """Get a file generated during the analysis.

        :param upload_id: the upload ID
        :return: the name on disk of the analysis file
        """
        analysis_file = await get_row_by_id(self._pg, SQLAnalysisFile, upload_id)

        if analysis_file:
            return analysis_file.name_on_disk

        raise ResourceNotFoundError()

    async def download(
        self,
        analysis_id: str,
        extension: str,
    ) -> tuple[bytes | str, str]:
        """Get an analysis to be downloaded in CSV or XSLX format.

        :param analysis_id: the analysis ID
        :param extension: the file extension
        :return: formatted file and file content type
        """
        document = await self._mongo.analyses.find_one(analysis_id)

        if document["results"] == "sql":
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    select(SQLAnalysisResult.results).where(
                        SQLAnalysisResult.analysis_id == analysis_id,
                    ),
                )

                document["results"] = result.scalars().one()

        if not document:
            raise ResourceNotFoundError()

        if extension == "xlsx":
            return (
                await virtool.analyses.format.format_analysis_to_excel(
                    self._config,
                    self._mongo,
                    document,
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

        return (
            await virtool.analyses.format.format_analysis_to_csv(
                self._config,
                self._mongo,
                document,
            ),
            "text/csv",
        )

    async def blast(self, analysis_id: str, sequence_index: int) -> str | None:
        """BLAST a contig sequence that is part of a NuVs result record.

        :param analysis_id: the analysis ID
        :param sequence_index: the sequence index
        :return: the nuvs sequence
        """
        timestamp = virtool.utils.timestamp()

        document = await self._mongo.analyses.find_one(
            {"_id": analysis_id},
            ["ready", "workflow", "results", "sample"],
        )

        if document["results"] == "sql":
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    select(SQLAnalysisResult.results).where(
                        SQLAnalysisResult.analysis_id == analysis_id,
                    ),
                )

                document["results"] = result.scalars().one()

        await wait_for_checks(
            check_if_analysis_is_nuvs(document["workflow"]),
            check_if_analysis_is_running(document["ready"]),
            check_analysis_nuvs_sequence(document, sequence_index),
        )

        async with AsyncSession(self._pg) as session:
            await session.execute(
                delete(SQLNuVsBlast)
                .where(SQLNuVsBlast.analysis_id == analysis_id)
                .where(SQLNuVsBlast.sequence_index == sequence_index),
            )
            await session.commit()

            await self._mongo.analyses.update_one(
                {"_id": analysis_id},
                {"$set": {"updated_at": virtool.utils.timestamp()}},
            )

            await session.flush()

            blast = SQLNuVsBlast(
                analysis_id=analysis_id,
                created_at=timestamp,
                last_checked_at=timestamp,
                ready=False,
                sequence_index=sequence_index,
                updated_at=timestamp,
            )

            session.add(blast)
            await session.flush()

            await self.data.tasks.create(
                BLASTTask,
                {"analysis_id": analysis_id, "sequence_index": sequence_index},
            )

            blast_data = blast.to_dict()
            await session.commit()

        return blast_data

    @emits(Operation.UPDATE)
    async def finalize(self, analysis_id: str, results: dict) -> Analysis:
        """Sets the result for an analysis and marks it as ready.

        :param analysis_id: the analysis ID
        :param results: the analysis results
        :return: the analysis
        """
        document = await self._mongo.analyses.find_one({"_id": analysis_id}, ["ready"])

        if not document:
            raise ResourceNotFoundError

        if document.get("ready"):
            raise ResourceConflictError

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            await pg_session.execute(
                insert(SQLAnalysisResult).values(
                    analysis_id=analysis_id,
                    results=results,
                ),
            )

            document = await self._mongo.analyses.find_one_and_update(
                {"_id": analysis_id},
                {"$set": {"results": "sql", "ready": True}},
            )

        sample_id = document["sample"]["id"]

        await recalculate_workflow_tags(self._mongo, sample_id)

        analysis, sample = await asyncio.gather(
            self.get(analysis_id, None),
            self.data.samples.get(sample_id),
        )

        emit(
            sample,
            "samples",
            "recalculate_workflow_tags",
            Operation.UPDATE,
        )

        return analysis
