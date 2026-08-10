"""The sample data layer domain."""

from asyncio import gather
from collections.abc import AsyncGenerator, AsyncIterator
from typing import Any

from sqlalchemy import (
    delete,
    exc,
    or_,
    select,
    update,
)
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.utils
from virtool.analyses.sql import SQLAnalysis, SQLAnalysisFile
from virtool.config.cls import Config
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import (
    compose_legacy_id_single_expression,
    compose_legacy_id_subquery,
)
from virtool.data.transforms import apply_transforms
from virtool.groups.models import GroupMinimal
from virtool.groups.pg import SQLGroup
from virtool.jobs.transforms import AttachJobTransform
from virtool.labels.transforms import AttachLabelsTransform
from virtool.samples.checks import (
    check_labels_do_not_exist,
    check_name_is_in_use,
    check_subtractions_do_not_exist,
)
from virtool.samples.db import (
    AttachReadsTransform,
    AttachUploadsTransform,
    DeriveWorkflowTagsTransform,
)
from virtool.samples.files import create_reads_file
from virtool.samples.models import Sample
from virtool.samples.oas import CreateSampleRequest
from virtool.samples.sql import (
    SQLLegacySample,
    SQLLegacySampleLabel,
    SQLLegacySampleSubtraction,
    SQLSampleReads,
    SQLSampleUpload,
)
from virtool.storage.cleanup import delete_keys
from virtool.storage.keys import mint_storage_key
from virtool.storage.protocol import StorageBackend
from virtool.subtractions.db import (
    AttachSubtractionsTransform,
)
from virtool.uploads.sql import SQLUpload
from virtool.uploads.utils import is_gzip_compressed
from virtool.users.pg import SQLUser
from virtool.users.transforms import AttachUserTransform
from virtool.utils import wait_for_checks

logger = get_logger("samples")


def _map_sample_minimal_row(
    row: SQLLegacySample,
    label_ids: list[int],
) -> dict[str, Any]:
    """Shape a ``SQLLegacySample`` row into the ``SampleMinimal`` transform input.

    ``legacy_id`` is carried for transforms that still bridge data from Mongo, which
    is keyed on the Mongo ``_id``. It is ignored by the ``SampleMinimal`` model.
    """
    return {
        "id": row.id,
        "legacy_id": row.legacy_id,
        "name": row.name,
        "created_at": row.created_at,
        "host": row.host,
        "isolate": row.isolate,
        "job": {"id": row.job_id} if row.job_id is not None else None,
        "labels": label_ids,
        "library_type": row.library_type,
        "notes": row.notes,
        "ready": row.ready,
        "user": row.user_id,
    }


def _map_sample_row(
    row: SQLLegacySample,
    label_ids: list[int],
    subtraction_ids: list[int],
) -> dict[str, Any]:
    """Shape a ``SQLLegacySample`` row into the full ``Sample`` transform input."""
    return {
        **_map_sample_minimal_row(row, label_ids),
        "all_read": row.all_read,
        "all_write": row.all_write,
        "format": row.format,
        "group_read": row.group_read,
        "group_write": row.group_write,
        "hold": row.hold,
        "is_legacy": row.is_legacy,
        "locale": row.locale,
        "quality": row.quality,
        "subtractions": subtraction_ids,
    }


class SamplesData(DataLayerDomain):
    name = "samples"

    def __init__(
        self,
        config: Config,
        pg: AsyncEngine,
        storage: StorageBackend,
    ):
        self._config = config
        self._pg = pg
        self._storage = storage

    async def _resolve_ids(self, sample_id: int | str) -> tuple[int, str | None] | None:
        """Resolve a sample's integer primary key and legacy Mongo id from either form.

        Accepts the outward-facing integer id or the legacy Mongo string. Samples
        migrated from Mongo keep their ``legacy_id`` as their storage key for life;
        samples created natively in Postgres have none and are keyed by primary key.

        :param sample_id: the integer primary key or legacy string id of the sample
        :return: the row's ``(id, legacy_id)``, or ``None`` if no sample matches
        """
        async with AsyncSession(self._pg) as session:
            return (
                await session.execute(
                    select(SQLLegacySample.id, SQLLegacySample.legacy_id).where(
                        compose_legacy_id_single_expression(SQLLegacySample, sample_id),
                    ),
                )
            ).one_or_none()

    async def get(self, sample_id: int | str) -> Sample:
        """Get a sample by its id.

        :param sample_id: the id of the sample
        :return: the sample
        :raises ResourceNotFoundError: when the sample does not exist
        """
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLLegacySample).where(
                        compose_legacy_id_single_expression(
                            SQLLegacySample,
                            sample_id,
                        ),
                    ),
                )
            ).scalar_one_or_none()

            if row is None:
                raise ResourceNotFoundError

            label_ids = list(
                (
                    await session.execute(
                        select(SQLLegacySampleLabel.label_id)
                        .where(SQLLegacySampleLabel.sample_id == row.id)
                        .order_by(SQLLegacySampleLabel.label_id),
                    )
                )
                .scalars()
                .all(),
            )

            subtraction_ids = list(
                (
                    await session.execute(
                        select(SQLLegacySampleSubtraction.subtraction_id)
                        .where(SQLLegacySampleSubtraction.sample_id == row.id)
                        .order_by(SQLLegacySampleSubtraction.subtraction_id),
                    )
                )
                .scalars()
                .all(),
            )

            group = None

            if row.group_id is not None:
                group_row = (
                    await session.execute(
                        select(SQLGroup).where(SQLGroup.id == row.group_id),
                    )
                ).scalar_one_or_none()

                if group_row is not None:
                    group = GroupMinimal(
                        id=group_row.id,
                        name=group_row.name,
                        legacy_id=group_row.legacy_id,
                    )

        document = await apply_transforms(
            _map_sample_row(row, label_ids, subtraction_ids),
            [
                DeriveWorkflowTagsTransform(),
                AttachReadsTransform(self._pg),
                AttachJobTransform(self._pg),
                AttachLabelsTransform(self._pg),
                AttachSubtractionsTransform(self._pg),
                AttachUploadsTransform(self._pg),
                AttachUserTransform(self._pg),
            ],
            self._pg,
        )

        return Sample(
            **{
                **document,
                "group": group,
                "paired": len(document["reads"]) == 2,
            },
        )

    @staticmethod
    def _add_legacy_sample_join_rows(
        pg_session: AsyncSession,
        sample_pk: int,
        labels: list[int],
        subtractions: list[int],
    ) -> None:
        """Add ``legacy_sample_labels`` and ``legacy_sample_subtractions`` join rows.

        The values are already integer ``labels.id`` and ``subtractions.id`` values,
        so they map directly with no legacy-id resolution.
        """
        for label_id in labels:
            pg_session.add(
                SQLLegacySampleLabel(sample_id=sample_pk, label_id=label_id),
            )

        for subtraction_id in subtractions:
            pg_session.add(
                SQLLegacySampleSubtraction(
                    sample_id=sample_pk,
                    subtraction_id=subtraction_id,
                ),
            )

    @emits(Operation.CREATE)
    async def create(
        self,
        data: CreateSampleRequest,
        user_id: int,
    ) -> Sample:
        """Create a sample."""
        settings = await self.data.settings.get_all()

        await wait_for_checks(
            check_name_is_in_use(self._pg, data.name),
            check_labels_do_not_exist(self._pg, data.labels),
            check_subtractions_do_not_exist(self._pg, data.subtractions),
        )

        if len(set(data.files)) != len(data.files):
            raise ResourceConflictError("File is duplicated")

        try:
            uploads = [
                (await self.data.uploads.get(file_)).dict() for file_ in data.files
            ]
        except ResourceNotFoundError:
            raise ResourceConflictError("File does not exist")

        if any(upload["reserved"] for upload in uploads):
            raise ResourceConflictError("File is already reserved")

        group = None

        # Require a valid ``group`` field if the ``sample_group`` setting is
        # ``users_primary_group``.
        if settings.sample_group == "force_choice":
            if data.group is None:
                raise ResourceConflictError("Group value required for sample creation")

            async with AsyncSession(self._pg) as session:
                if not await session.get(
                    SQLGroup,
                    data.group,
                ):
                    raise ResourceConflictError("Group does not exist")

            group = data.group

        # Assign the user's primary group as the sample owner group if the
        # setting is ``users_primary_group``.
        elif settings.sample_group == "users_primary_group":
            async with AsyncSession(self._pg) as session:
                user = await session.get(SQLUser, user_id)

            if user is not None and user.primary_group is not None:
                group = user.primary_group.id

        async with AsyncSession(self._pg) as pg_session:
            await self.data.uploads.reserve(data.files, pg_session)

            # Create the job inside the sample's transaction so the job and its
            # sample commit atomically. The job's ``sample_id`` argument is
            # derived from ``legacy_samples.job_id`` on read, so the job must not
            # become claimable before its sample row exists.
            job_id = await self.data.jobs.create_in_session(
                pg_session,
                "create_sample",
                {},
                user_id,
            )

            sample = SQLLegacySample(
                all_read=settings.sample_all_read,
                all_write=settings.sample_all_write,
                created_at=virtool.utils.timestamp(),
                format="fastq",
                group_id=group,
                group_read=settings.sample_group_read,
                group_write=settings.sample_group_write,
                hold=True,
                host=data.host,
                is_legacy=False,
                isolate=data.isolate,
                job_id=job_id,
                library_type=data.library_type,
                locale=data.locale,
                name=data.name,
                notes=data.notes,
                paired=len(uploads) == 2,
                quality=None,
                ready=False,
                user_id=user_id,
            )

            pg_session.add(sample)
            await pg_session.flush()

            sample_pk = sample.id

            self._add_legacy_sample_join_rows(
                pg_session,
                sample_pk,
                data.labels,
                data.subtractions,
            )

            for index, upload in enumerate(uploads):
                pg_session.add(
                    SQLSampleUpload(
                        sample=str(sample_pk),
                        sample_id=sample_pk,
                        upload_id=upload["id"],
                        index=index,
                    ),
                )

            await pg_session.commit()

        emit(await self.data.jobs.get(job_id), "jobs", "create", Operation.CREATE)

        return await self.get(sample_pk)

    @emits(Operation.DELETE)
    async def delete(self, sample_id: int | str) -> Sample:
        """Delete the sample identified by ``sample_id`` and all its analyses.

        :param sample_id: the id of the sample to delete
        :return: the deleted sample

        """
        resolved = await self._resolve_ids(sample_id)

        if resolved is None:
            raise ResourceNotFoundError

        sample_pk, legacy_id = resolved

        sample = await self.get(sample_id)

        upload_ids = [upload.id for upload in sample.uploads or []]

        async with AsyncSession(self._pg) as pg_session:
            if upload_ids:
                await pg_session.execute(
                    update(SQLUpload)
                    .where(SQLUpload.id.in_(upload_ids))
                    .values(reserved=False),
                )

            # Every key must be read before its row is deleted. Analysis files
            # are reached through the sample's analyses, whose rows cascade them
            # away, so they are collected here rather than by AnalysisData.
            storage_keys = [
                key
                for key in (
                    await pg_session.execute(
                        select(SQLSampleReads.storage_key)
                        .where(SQLSampleReads.sample_id == sample_pk)
                        .union_all(
                            select(SQLAnalysisFile.storage_key)
                            .join(
                                SQLAnalysis,
                                SQLAnalysis.id == SQLAnalysisFile.analysis_id,
                            )
                            .where(SQLAnalysis.sample_id == sample_pk),
                        ),
                    )
                ).scalars()
                if key is not None
            ]

            await pg_session.execute(
                delete(SQLAnalysis).where(
                    SQLAnalysis.sample_id == sample_pk,
                ),
            )

            await pg_session.execute(
                delete(SQLSampleUpload).where(
                    or_(
                        SQLSampleUpload.sample_id == sample_pk,
                        SQLSampleUpload.sample == legacy_id,
                    ),
                ),
            )
            await pg_session.execute(
                delete(SQLSampleReads).where(
                    or_(
                        SQLSampleReads.sample_id == sample_pk,
                        SQLSampleReads.sample == legacy_id,
                    ),
                ),
            )
            result = await pg_session.execute(
                delete(SQLLegacySample).where(
                    SQLLegacySample.id == sample_pk,
                ),
            )

            if not result.rowcount:
                raise ResourceNotFoundError

            await pg_session.commit()

        for key, failure in await delete_keys(self._storage, storage_keys):
            logger.error(
                "storage cleanup failed; file orphaned",
                sample_id=sample_pk,
                key=key,
                error=repr(failure),
            )

        return sample

    @emits(Operation.UPDATE, name="finalize")
    async def finalize(
        self,
        sample_id: int | str,
        quality: dict[str, Any],
    ) -> Sample:
        """Finalize a sample by setting a ``quality`` field and ``ready`` to ``True``.

        :param sample_id: the id of the sample
        :param quality: a dict containing quality data
        :return: the sample after finalizing
        """
        resolved = await self._resolve_ids(sample_id)

        if resolved is None:
            raise ResourceNotFoundError

        sample_pk, _ = resolved

        async with AsyncSession(self._pg) as pg_session:
            ready = (
                await pg_session.execute(
                    select(SQLLegacySample.ready).where(
                        SQLLegacySample.id == sample_pk,
                    ),
                )
            ).scalar_one_or_none()

            if ready is None:
                raise ResourceNotFoundError

            if ready:
                raise ResourceConflictError("Sample already finalized")

            await pg_session.execute(
                update(SQLLegacySample)
                .where(SQLLegacySample.id == sample_pk)
                .values(quality=quality, ready=True),
            )

            await pg_session.commit()

        storage_keys = []

        async with AsyncSession(self._pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLUpload)
                        .join(
                            SQLSampleUpload,
                            SQLSampleUpload.upload_id == SQLUpload.id,
                        )
                        .where(SQLSampleUpload.sample_id == sample_pk),
                    )
                )
                .unique()
                .scalars()
            )

            for row in rows:
                if row.storage_key is not None:
                    storage_keys.append(row.storage_key)

                row.removed = True
                row.removed_at = virtool.utils.timestamp()
                session.add(row)

            await session.commit()

        await gather(*[self._storage.delete(key) for key in storage_keys])

        return await self.get(sample_id)

    async def upload_reads(
        self,
        sample_id: int | str,
        filename: str,
        chunker: AsyncGenerator[bytearray],
        upload_id: int | None = None,
    ) -> dict:
        resolved = await self._resolve_ids(sample_id)

        if resolved is None:
            raise ResourceNotFoundError

        sample_pk, legacy_id = resolved
        key = mint_storage_key("samples", sample_pk)

        first = await anext(chunker, None)

        if not first:
            raise EOFError("Reads file is empty")

        is_gzip_compressed(first)

        async def _stream() -> AsyncIterator[bytearray]:
            yield first
            async for chunk in chunker:
                yield chunk

        size = await self._storage.write(key, _stream())

        try:
            return await create_reads_file(
                self._pg,
                size,
                filename,
                filename,
                sample_pk,
                key,
                upload_id=upload_id,
            )
        except exc.IntegrityError:
            await self._storage.delete(key)
            raise ResourceConflictError(
                "Reads file name is already uploaded for this sample",
            )

    async def get_reads_file(
        self,
        sample_id: int | str,
        filename: str,
    ) -> tuple[AsyncIterator[bytes], int, str]:
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLSampleReads).where(
                        SQLSampleReads.sample_id
                        == compose_legacy_id_subquery(SQLLegacySample, sample_id),
                        SQLSampleReads.name == filename,
                    ),
                )
            ).scalar()

        if row is None:
            raise ResourceNotFoundError

        return self._storage.read(row.storage_key), row.size, filename
