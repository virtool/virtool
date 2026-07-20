import asyncio
import math
from collections.abc import AsyncIterator
from datetime import datetime

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.analyses.format
import virtool.uploads.db
from virtool.analyses.checks import (
    check_analysis_nuvs_sequence,
    check_if_analysis_is_nuvs,
    check_if_analysis_is_running,
    check_if_analysis_modified,
)
from virtool.analyses.db import (
    AttachAnalysisSubtractionsTransform,
    bump_analysis_updated_at,
)
from virtool.analyses.files import create_analysis_file
from virtool.analyses.models import Analysis, AnalysisFile, AnalysisSearchResult
from virtool.analyses.sql import SQLAnalysis, SQLAnalysisFile, SQLAnalysisSubtraction
from virtool.analyses.utils import (
    analysis_file_key,
    attach_analysis_files,
)
from virtool.blast.sql import SQLNuVsBlast
from virtool.blast.transform import AttachNuVsBLAST
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import (
    compose_legacy_id_single_expression,
    compose_legacy_id_subquery,
)
from virtool.data.transforms import apply_transforms
from virtool.indexes.sql import SQLIndex
from virtool.jobs.transforms import AttachJobTransform
from virtool.pg.utils import delete_row, get_row_by_id
from virtool.references.sql import SQLReference
from virtool.references.transforms import AttachReferenceTransform
from virtool.samples.db import compose_sample_rights_filter
from virtool.samples.oas import CreateAnalysisRequest
from virtool.samples.sql import SQLLegacySample
from virtool.samples.utils import (
    SAMPLE_RIGHTS_COLUMNS,
    SampleRight,
    has_sample_right,
)
from virtool.storage.cleanup import delete_prefix
from virtool.storage.protocol import StorageBackend
from virtool.subtractions.pg import SQLSubtraction
from virtool.users.transforms import AttachUserTransform
from virtool.utils import wait_for_checks

logger = get_logger("analyses")

FIND_COLUMNS = (
    SQLAnalysis.id,
    SQLAnalysis.legacy_id,
    SQLAnalysis.created_at,
    SQLAnalysis.updated_at,
    SQLAnalysis.workflow,
    SQLAnalysis.ready,
    SQLAnalysis.sample,
    SQLAnalysis.sample_id,
    SQLAnalysis.reference,
    SQLAnalysis.reference_id,
    SQLAnalysis.index,
    SQLAnalysis.index_id,
    SQLAnalysis.user_id,
    SQLAnalysis.job_id,
)
"""The ``SQLAnalysis`` columns selected for list views.

The TOASTed ``results`` column is deliberately excluded.
"""

INDEX_COLUMNS = (
    SQLIndex.id.label("index_pg_id"),
    SQLIndex.legacy_id.label("index_legacy_id"),
    SQLIndex.version.label("index_version"),
)
"""The joined ``SQLIndex`` columns that supply the nested ``{id, version}``.

The version is not stored on ``analyses``, so it is read from ``indexes`` via the
``analyses.index_id`` foreign key. Selected through an outer join so an analysis whose
index cannot be resolved survives the query and raises loudly in ``_row_to_document``
rather than silently dropping from a list.
"""


def _row_to_document(row, *, include_results: bool) -> dict:
    """Shape a ``SQLAnalysis`` row into the Mongo-like document the transforms and
    formatters expect.

    The integer primary key is the outward-facing ``id``. The legacy Mongo slug is
    carried in ``legacy_id`` so analyses migrated from Mongo can still be addressed by
    their old string id and have their slug-prefixed storage objects cleaned up;
    Postgres-native analyses have a ``NULL`` slug.

    The nested reference is keyed by the integer ``reference_id`` foreign key, falling
    back to the legacy ``reference`` string on rows the backfill has not reached.
    ``AttachReferenceTransform`` resolves either form.

    The nested index is read from the joined ``SQLIndex`` columns. Its outward id is the
    legacy string, falling back to the stringified integer primary key for
    Postgres-native indexes that never had one. A ``NULL`` join means ``index_id`` did
    not resolve to a build, which is a data-integrity failure that must surface loudly.
    """
    if row.index_pg_id is None:
        raise ValueError(f"Index not found for analysis {row.id}: {row.index}")

    document = {
        "id": row.id,
        "legacy_id": row.legacy_id,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "workflow": row.workflow,
        "ready": row.ready,
        "sample": {"id": row.sample_id},
        "reference": {
            "id": row.reference_id if row.reference_id is not None else row.reference,
        },
        "index": {
            "id": row.index_legacy_id
            if row.index_legacy_id is not None
            else str(row.index_pg_id),
            "version": row.index_version,
        },
        "user": {"id": row.user_id},
        "job": {"id": row.job_id} if row.job_id else None,
    }

    if include_results:
        document["results"] = row.results

    return document


class AnalysisData(DataLayerDomain):
    name = "analyses"

    def __init__(self, pg: AsyncEngine, storage: StorageBackend):
        self._pg = pg
        self._storage = storage

    async def _resolve_ids(self, analysis_id: int | str):
        """Resolve the integer id and legacy slug for an analysis by either identifier.

        Accepts the outward-facing integer id or the legacy Mongo slug and returns the
        row's ``(id, legacy_id)``, or ``None`` if no analysis matches. The slug is only
        retained for analyses migrated from Mongo, where it locates their slug-prefixed
        objects in storage during deletion; Postgres-native analyses have a ``NULL``
        slug.
        """
        async with AsyncSession(self._pg) as session:
            return (
                await session.execute(
                    select(SQLAnalysis.id, SQLAnalysis.legacy_id).where(
                        compose_legacy_id_single_expression(SQLAnalysis, analysis_id),
                    ),
                )
            ).one_or_none()

    async def find(
        self,
        page: int,
        per_page: int,
        client,
        sample_id: str = None,
    ) -> AnalysisSearchResult:
        """List all analysis documents.

        Only analyses on samples the client has read rights to are listed.

        :param page: the page number
        :param per_page: the number of documents per page
        :param client: the client object
        :param sample_id: sample id to search by
        :return: a list of all analysis documents
        """
        skip_count = 0

        if page > 1:
            skip_count = (page - 1) * per_page

        readable_sample_ids = select(SQLLegacySample.id).where(
            compose_sample_rights_filter(client),
        )

        filters = [
            SQLAnalysis.sample_id.in_(readable_sample_ids),
        ]

        if sample_id is not None:
            filters.append(
                SQLAnalysis.sample_id
                == compose_legacy_id_subquery(SQLLegacySample, sample_id),
            )

        count_statement = select(func.count()).select_from(SQLAnalysis).where(*filters)
        statement = (
            select(*FIND_COLUMNS, *INDEX_COLUMNS)
            .outerjoin(SQLIndex, SQLAnalysis.index_id == SQLIndex.id)
            .where(*filters)
            .order_by(
                SQLAnalysis.created_at.desc(),
                SQLAnalysis.id.desc(),
            )
        )

        async with AsyncSession(self._pg) as session:
            total_count = (await session.execute(count_statement)).scalar_one()
            rows = (
                await session.execute(statement.offset(skip_count).limit(per_page))
            ).all()

        documents = [_row_to_document(row, include_results=False) for row in rows]

        documents = await apply_transforms(
            documents,
            [
                AttachJobTransform(self._pg),
                AttachReferenceTransform(self._pg),
                AttachAnalysisSubtractionsTransform(self._pg),
                AttachUserTransform(self._pg),
            ],
            self._pg,
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
        if_modified_since: datetime | None = None,
    ) -> Analysis:
        """Get a single analysis by its ID.

        :param analysis_id: the analysis ID
        :param if_modified_since: the date the document should have been last modified
        :return: the analysis
        """
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(*FIND_COLUMNS, SQLAnalysis.results, *INDEX_COLUMNS)
                    .outerjoin(SQLIndex, SQLAnalysis.index_id == SQLIndex.id)
                    .where(
                        compose_legacy_id_single_expression(SQLAnalysis, analysis_id),
                    ),
                )
            ).one_or_none()

        if row is None:
            raise ResourceNotFoundError()

        document = _row_to_document(row, include_results=True)

        await wait_for_checks(check_if_analysis_modified(if_modified_since, document))

        document = await attach_analysis_files(self._pg, row.id, document)

        if document["ready"]:
            document["results"] = await virtool.analyses.format.format_analysis(
                self._pg,
                workflow=document["workflow"],
                results=document["results"],
            )

        transforms = [
            AttachJobTransform(self._pg),
            AttachReferenceTransform(self._pg),
            AttachAnalysisSubtractionsTransform(self._pg),
            AttachUserTransform(self._pg),
        ]

        if document["workflow"] == "nuvs":
            transforms.append(AttachNuVsBLAST(self._pg))

        document = await apply_transforms(document, transforms, self._pg)

        return Analysis.parse_obj(
            {**document, "job": document["job"] if document["job"] else None},
        )

    @emits(Operation.CREATE, "analyses")
    async def create(
        self,
        data: CreateAnalysisRequest,
        sample_id: str,
        user_id: int,
    ) -> Analysis:
        """Creates a new analysis.

        Ensures that a valid subtraction host was the submitted. Configures read and
        write permissions on the sample document and assigns it a creator username
        based on the requesting connection.

        :param data: the analysis creation input data
        :param sample_id: the ID of the sample to create an analysis for
        :param user_id: the ID of the user starting the job
        :return: the analysis

        """
        created_at = virtool.utils.timestamp()

        subtractions = data.subtractions if data.subtractions is not None else []

        async with AsyncSession(self._pg) as session:
            # Create the job inside the analysis's transaction so the job and its
            # analysis commit atomically. The job's ``analysis_id`` argument is
            # derived from ``analyses.job_id`` on read, so the job must not become
            # claimable before its analysis row exists.
            job_id = await self.data.jobs.create_in_session(
                session,
                data.workflow.value,
                {},
                user_id,
            )

            sample_row = (
                await session.execute(
                    select(SQLLegacySample.id, SQLLegacySample.legacy_id).where(
                        compose_legacy_id_single_expression(SQLLegacySample, sample_id),
                    ),
                )
            ).one_or_none()

            if sample_row is None:
                raise ResourceConflictError("Sample does not exist")

            sample_pg_id, sample_legacy_id = sample_row

            reference_row = (
                await session.execute(
                    select(SQLReference.id, SQLReference.legacy_id).where(
                        compose_legacy_id_single_expression(SQLReference, data.ref_id),
                    ),
                )
            ).one_or_none()

            if reference_row is None:
                raise ResourceConflictError("Reference does not exist")

            reference_pg_id, reference_legacy_id = reference_row

            # Resolve the reference's current ready index inside the transaction,
            # replacing the pre-session Mongo read. The current index is the
            # highest-versioned ready build. The "No ready index" guard in
            # ``SampleData`` guarantees one exists by the time create runs, so
            # ``.one()`` never trips in practice; if it does, an analysis without an
            # index is a data-integrity failure that must surface loudly.
            index_pg_id, index_legacy_id = (
                await session.execute(
                    select(SQLIndex.id, SQLIndex.legacy_id)
                    .where(
                        SQLIndex.reference_id == reference_pg_id,
                        SQLIndex.ready.is_(True),
                    )
                    .order_by(SQLIndex.version.desc())
                    .limit(1),
                )
            ).one()

            pg_id = (
                await session.execute(
                    insert(SQLAnalysis)
                    .values(
                        created_at=created_at,
                        updated_at=created_at,
                        workflow=data.workflow.value,
                        ready=False,
                        results=None,
                        sample=sample_legacy_id or str(sample_pg_id),
                        sample_id=sample_pg_id,
                        reference=reference_legacy_id or str(reference_pg_id),
                        reference_id=reference_pg_id,
                        index=index_legacy_id or str(index_pg_id),
                        index_id=index_pg_id,
                        user_id=user_id,
                        job_id=job_id,
                    )
                    .returning(SQLAnalysis.id),
                )
            ).scalar_one()

            if subtractions:
                rows = (
                    await session.execute(
                        select(SQLSubtraction.id).where(
                            SQLSubtraction.id.in_(subtractions),
                            SQLSubtraction.deleted.is_(False),
                        ),
                    )
                ).all()

                existing = {id_ for (id_,) in rows}

                missing = set(subtractions) - existing
                if missing:
                    raise ResourceConflictError(
                        "Subtractions do not exist: "
                        + ", ".join(str(s) for s in sorted(missing)),
                    )

                session.add_all(
                    SQLAnalysisSubtraction(
                        analysis_id=pg_id,
                        subtraction_id=subtraction_id,
                    )
                    for subtraction_id in existing
                )

            await session.commit()

        emit(await self.data.jobs.get(job_id), "jobs", "create", Operation.CREATE)

        return await self.get(pg_id, None)

    async def has_right(self, analysis_id: str, client, right: str) -> bool:
        """Checks if the client has the `read` or `write` rights.

        :param analysis_id: the analysis ID
        :param client: the client object
        :param right: the right to check for
        :return: boolean value
        """
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(*SAMPLE_RIGHTS_COLUMNS)
                    .join(SQLAnalysis, SQLAnalysis.sample_id == SQLLegacySample.id)
                    .where(
                        compose_legacy_id_single_expression(SQLAnalysis, analysis_id),
                    ),
                )
            ).first()

        if row is None:
            logger.warning(
                "analysis or parent sample not found",
                analysis_id=analysis_id,
            )
            raise ResourceNotFoundError

        return has_sample_right(row, client, SampleRight(right))

    async def delete(self, analysis_id: str, jobs_api_flag: bool) -> None:
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

        legacy_id = (await self._resolve_ids(analysis.id)).legacy_id

        async with AsyncSession(self._pg) as session:
            sample_legacy_id = (
                await session.execute(
                    select(SQLAnalysis.sample).where(SQLAnalysis.id == analysis.id),
                )
            ).scalar_one_or_none()

            await session.execute(
                delete(SQLAnalysis).where(SQLAnalysis.id == analysis.id),
            )

            await session.commit()

        # Only analyses migrated from Mongo have a ``legacy_id`` and slug-prefixed
        # storage objects to clean up. Postgres-native analyses store no results in
        # object storage, so there is nothing to delete.
        if legacy_id is not None:
            for key, exc in await delete_prefix(
                self._storage,
                f"samples/{sample_legacy_id}/analysis/{legacy_id}/",
            ):
                logger.error(
                    "storage cleanup failed; file orphaned",
                    analysis_id=analysis.id,
                    sample_id=analysis.sample.id,
                    key=key,
                    error=repr(exc),
                )

        emit(
            await self.data.samples.get(analysis.sample.id),
            "samples",
            "update",
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
        ids = await self._resolve_ids(analysis_id)

        if ids is None:
            raise ResourceNotFoundError

        analysis_file = await create_analysis_file(
            self._pg,
            ids.id,
            analysis_format,
            name,
        )

        upload_id = analysis_file["id"]

        try:
            size = await self._storage.write(
                analysis_file_key(analysis_file["name_on_disk"]),
                chunks,
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

        return AnalysisFile(**{**analysis_file, "analysis": ids.id})

    async def download_file(
        self,
        upload_id: int,
    ) -> tuple[AsyncIterator[bytes], int, str]:
        """Download a file generated during an analysis.

        :param upload_id: the upload ID
        :return: the file stream, size, and filename
        """
        analysis_file = await get_row_by_id(self._pg, SQLAnalysisFile, upload_id)

        if not analysis_file:
            raise ResourceNotFoundError()

        key = analysis_file_key(analysis_file.name_on_disk)

        return self._storage.read(key), analysis_file.size, analysis_file.name

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
        async with AsyncSession(self._pg) as session:
            analysis = (
                await session.execute(
                    select(
                        SQLAnalysis.workflow,
                        SQLAnalysis.results,
                        SQLAnalysis.legacy_id,
                        SQLAnalysis.sample,
                    ).where(
                        compose_legacy_id_single_expression(SQLAnalysis, analysis_id),
                    ),
                )
            ).one_or_none()

        if analysis is None:
            raise ResourceNotFoundError()

        if extension == "xlsx":
            return (
                await virtool.analyses.format.format_analysis_to_excel(
                    self._pg,
                    results=analysis.results,
                    workflow=analysis.workflow,
                    sample_id=analysis.sample,
                ),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

        return (
            await virtool.analyses.format.format_analysis_to_csv(
                self._pg,
                results=analysis.results,
                workflow=analysis.workflow,
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

        async with AsyncSession(self._pg) as session:
            analysis = (
                await session.execute(
                    select(
                        SQLAnalysis.id,
                        SQLAnalysis.workflow,
                        SQLAnalysis.ready,
                        SQLAnalysis.results,
                    ).where(
                        compose_legacy_id_single_expression(SQLAnalysis, analysis_id),
                    ),
                )
            ).one_or_none()

        if analysis is None:
            raise ResourceNotFoundError()

        await wait_for_checks(
            check_if_analysis_is_nuvs(analysis.workflow),
            check_if_analysis_is_running(analysis.ready),
            check_analysis_nuvs_sequence(analysis.results, sequence_index),
        )

        async with AsyncSession(self._pg) as session:
            await session.execute(
                delete(SQLNuVsBlast)
                .where(SQLNuVsBlast.analysis_id == analysis.id)
                .where(SQLNuVsBlast.sequence_index == sequence_index),
            )
            await session.flush()

            blast = SQLNuVsBlast(
                analysis_id=analysis.id,
                created_at=timestamp,
                last_checked_at=timestamp,
                ready=False,
                sequence_index=sequence_index,
                updated_at=timestamp,
            )

            session.add(blast)
            await session.flush()

            await bump_analysis_updated_at(session, analysis.id, timestamp)

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
        updated_at = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(
                        SQLAnalysis.id,
                        SQLAnalysis.legacy_id,
                        SQLAnalysis.ready,
                        SQLAnalysis.sample,
                    ).where(
                        compose_legacy_id_single_expression(SQLAnalysis, analysis_id),
                    ),
                )
            ).one_or_none()

        if row is None:
            raise ResourceNotFoundError

        if row.ready:
            raise ResourceConflictError

        sample_id = row.sample

        async with AsyncSession(self._pg) as session:
            await session.execute(
                update(SQLAnalysis)
                .where(SQLAnalysis.id == row.id)
                .values(ready=True, results=results, updated_at=updated_at),
            )

            await session.commit()

        analysis, sample = await asyncio.gather(
            self.get(analysis_id, None),
            self.data.samples.get(sample_id),
        )

        emit(
            sample,
            "samples",
            "update",
            Operation.UPDATE,
        )

        return analysis
