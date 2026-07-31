import asyncio
from datetime import datetime

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.analyses.format
import virtool.uploads.db
from virtool.analyses.checks import (
    check_if_analysis_modified,
)
from virtool.analyses.db import (
    AttachAnalysisSubtractionsTransform,
)
from virtool.analyses.files import create_analysis_file
from virtool.analyses.models import Analysis, AnalysisFile
from virtool.analyses.sql import SQLAnalysis, SQLAnalysisFile
from virtool.analyses.utils import (
    analysis_file_key,
    attach_analysis_files,
)
from virtool.blast.transform import AttachNuVsBLAST
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import (
    compose_legacy_id_single_expression,
)
from virtool.data.transforms import apply_transforms
from virtool.indexes.sql import SQLIndex
from virtool.jobs.transforms import AttachJobTransform
from virtool.pg.utils import delete_row
from virtool.references.transforms import AttachReferenceTransform
from virtool.storage.cleanup import delete_prefix
from virtool.storage.protocol import StorageBackend
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
    SQLAnalysis.index_id,
    SQLAnalysis.user_id,
    SQLAnalysis.job_id,
)
"""The ``SQLAnalysis`` columns selected for list views.

The TOASTed ``results`` column is deliberately excluded.
"""

INDEX_COLUMNS = (
    SQLIndex.id.label("index_pg_id"),
    SQLIndex.version.label("index_version"),
)
"""The joined ``SQLIndex`` columns that supply the nested ``{id, version}``.

The version is not stored on ``analyses``, so it is read from ``indexes`` via the
``analyses.index_id`` foreign key. An inner join is safe: ``index_id`` is ``NOT NULL``
and a foreign key, so every analysis has exactly one matching build and none can be
dropped from a result by the join.
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
    integer primary key: indexes are addressed publicly by their Postgres id.
    """
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
            "id": row.index_pg_id,
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
                    .join(SQLIndex, SQLAnalysis.index_id == SQLIndex.id)
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
