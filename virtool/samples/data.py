"""The sample data layer domain."""

import math
from asyncio import CancelledError, gather
from collections import defaultdict
from collections.abc import AsyncGenerator, AsyncIterator
from typing import Any

from pymongo.results import UpdateResult
from sqlalchemy import (
    ColumnExpressionArgument,
    and_,
    delete,
    exc,
    func,
    or_,
    select,
    update,
)
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.uploads.db
import virtool.utils
from virtool.analyses.sql import SQLAnalysis, SQLAnalysisResult
from virtool.api.client import UserClient
from virtool.config.cls import Config
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import (
    both_transactions,
    compose_legacy_id_multi_expression,
    compose_legacy_id_single_expression,
    compose_legacy_id_subquery,
    retry_both_transactions,
)
from virtool.data.transforms import apply_transforms
from virtool.groups.models import GroupMinimal
from virtool.groups.pg import SQLGroup
from virtool.jobs.transforms import AttachJobTransform
from virtool.labels.transforms import AttachLabelsTransform
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_new_id, get_one_field
from virtool.pg.utils import delete_row
from virtool.references.db import compose_reference_id_match
from virtool.samples.checks import (
    check_labels_do_not_exist,
    check_name_is_in_use,
    check_subtractions_do_not_exist,
)
from virtool.samples.db import (
    AttachArtifactsAndReadsTransform,
    AttachUploadsTransform,
    DeriveWorkflowTagsTransform,
    compose_sample_workflow_filter,
)
from virtool.samples.files import (
    create_artifact_file,
    create_reads_file,
)
from virtool.samples.models import Sample, SampleSearchResult
from virtool.samples.oas import CreateSampleRequest, UpdateSampleRequest
from virtool.samples.sql import (
    ArtifactType,
    SQLLegacySample,
    SQLLegacySampleLabel,
    SQLLegacySampleSubtraction,
    SQLSampleArtifact,
    SQLSampleReads,
    SQLSampleUpload,
)
from virtool.samples.utils import (
    SampleRight,
    define_initial_workflows,
    sample_file_key,
    sample_prefix,
)
from virtool.storage.cleanup import delete_prefix
from virtool.storage.protocol import StorageBackend
from virtool.subtractions.db import (
    AttachSubtractionsTransform,
    get_missing_subtraction_ids,
)
from virtool.uploads.sql import SQLUpload
from virtool.uploads.utils import is_gzip_compressed, upload_file_key
from virtool.users.pg import SQLUser
from virtool.users.transforms import AttachUserTransform
from virtool.utils import wait_for_checks

logger = get_logger("samples")


def _compose_sample_search_filter(term: str) -> ColumnExpressionArgument[bool]:
    """Compose a case-insensitive substring match on ``name`` and the owner id.

    Mirrors the Mongo ``compose_regex_query(term, ["name", "user.id"])`` the find
    endpoint used before reading from Postgres: the term is matched literally, so SQL
    ``LIKE`` wildcards in the term are escaped rather than interpreted. The historical
    ``user.id`` value is the owner's legacy Mongo id, now ``SQLUser.legacy_id``.
    """
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"

    return or_(
        SQLLegacySample.name.ilike(pattern, escape="\\"),
        SQLLegacySample.user_id.in_(
            select(SQLUser.id).where(SQLUser.legacy_id.ilike(pattern, escape="\\")),
        ),
    )


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


async def _get_labels_by_sample(
    session: AsyncSession,
    sample_ids: list[int],
) -> dict[int, list[int]]:
    """Map each sample's integer PK to its ordered list of label ids."""
    if not sample_ids:
        return {}

    rows = (
        await session.execute(
            select(SQLLegacySampleLabel.sample_id, SQLLegacySampleLabel.label_id)
            .where(SQLLegacySampleLabel.sample_id.in_(sample_ids))
            .order_by(SQLLegacySampleLabel.label_id),
        )
    ).all()

    labels_by_sample: dict[int, list[int]] = defaultdict(list)

    for sample_id, label_id in rows:
        labels_by_sample[sample_id].append(label_id)

    return labels_by_sample


class SamplesData(DataLayerDomain):
    name = "samples"

    def __init__(
        self,
        config: Config,
        mongo: Mongo,
        pg: AsyncEngine,
        storage: StorageBackend,
    ):
        self._config = config
        self._mongo = mongo
        self._pg = pg
        self._storage = storage

    async def _resolve_ids(self, sample_id: int | str) -> tuple[int, str | None] | None:
        """Resolve a sample's integer primary key and legacy Mongo id from either form.

        Accepts the outward-facing integer id or the legacy Mongo string. The legacy
        string is still required for Mongo dual-writes and storage keys, which remain
        keyed on the Mongo ``_id`` until the samples migration completes.

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

    async def find(
        self,
        labels: list[int],
        page: int,
        per_page: int,
        term: str,
        workflows: list[str],
        client,
    ) -> SampleSearchResult:
        """Find and filter samples."""
        filters = [await self._compose_rights_filter(client)]

        if term:
            filters.append(_compose_sample_search_filter(term))

        if labels:
            filters.append(
                SQLLegacySample.id.in_(
                    select(SQLLegacySampleLabel.sample_id).where(
                        SQLLegacySampleLabel.label_id.in_(labels),
                    ),
                ),
            )

        if workflows:
            workflow_filter = compose_sample_workflow_filter(workflows)

            if workflow_filter is not None:
                filters.append(workflow_filter)

        async with AsyncSession(self._pg) as session:
            total_count = await session.scalar(
                select(func.count()).select_from(SQLLegacySample),
            )
            found_count = await session.scalar(
                select(func.count()).select_from(SQLLegacySample).where(*filters),
            )

            rows = (
                (
                    await session.execute(
                        select(SQLLegacySample)
                        .where(*filters)
                        .order_by(
                            SQLLegacySample.created_at.desc(),
                            SQLLegacySample.id,
                        )
                        .offset(per_page * (page - 1))
                        .limit(per_page),
                    )
                )
                .scalars()
                .all()
            )

            labels_by_sample = await _get_labels_by_sample(
                session,
                [row.id for row in rows],
            )

        documents = await apply_transforms(
            [
                _map_sample_minimal_row(row, labels_by_sample.get(row.id, []))
                for row in rows
            ],
            [
                DeriveWorkflowTagsTransform(),
                AttachJobTransform(self._pg),
                AttachLabelsTransform(self._pg),
                AttachUploadsTransform(self._pg),
                AttachUserTransform(self._pg),
            ],
            self._pg,
        )

        return SampleSearchResult(
            documents=documents,
            found_count=found_count,
            total_count=total_count,
            page=page,
            page_count=int(math.ceil(found_count / per_page)),
            per_page=per_page,
        )

    async def _resolve_client_group_ids(self, client) -> list[int]:
        """Resolve the Postgres group ids for the groups ``client`` belongs to.

        Shared by ``_compose_rights_filter`` and ``has_right`` so the two rights
        paths resolve group membership the same way.
        """
        if not client.groups:
            return []

        async with AsyncSession(self._pg) as session:
            return list(
                (
                    await session.execute(
                        select(SQLGroup.id).where(
                            compose_legacy_id_multi_expression(
                                SQLGroup,
                                client.groups,
                            ),
                        ),
                    )
                )
                .scalars()
                .all(),
            )

    async def _compose_rights_filter(
        self,
        client,
    ) -> ColumnExpressionArgument[bool]:
        """Compose the Postgres predicate scoping samples to those ``client`` can read.

        Mirrors the Mongo ``$or`` rights filter: the requesting user owns the sample,
        the sample is world-readable, or the sample is readable by a group the user
        belongs to.
        """
        rights_filter = [
            SQLLegacySample.all_read.is_(True),
            SQLLegacySample.user_id == client.user_id,
        ]

        group_ids = await self._resolve_client_group_ids(client)

        if group_ids:
            rights_filter.append(
                and_(
                    SQLLegacySample.group_read.is_(True),
                    SQLLegacySample.group_id.in_(group_ids),
                ),
            )

        return or_(*rights_filter)

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
                AttachArtifactsAndReadsTransform(self._pg),
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

    async def _write_legacy_sample(
        self,
        pg_session: AsyncSession,
        document: dict[str, Any],
    ) -> None:
        """Write the ``legacy_samples`` row and join rows for a new ``document``.

        The label and subtraction join-row values are already integer ``labels.id``
        and ``subtractions.id`` values, so they map directly with no legacy-id
        resolution.
        """
        group = document["group"]

        sample = SQLLegacySample(
            legacy_id=document["_id"],
            name=document["name"],
            host=document["host"],
            isolate=document["isolate"],
            locale=document["locale"],
            notes=document["notes"],
            library_type=document["library_type"],
            format=document["format"],
            group_id=group if isinstance(group, int) else None,
            quality=document["quality"],
            created_at=document["created_at"],
            paired=document["paired"],
            ready=document["ready"],
            hold=document["hold"],
            is_legacy=document["is_legacy"],
            all_read=document["all_read"],
            all_write=document["all_write"],
            group_read=document["group_read"],
            group_write=document["group_write"],
            user_id=document["user"]["id"],
            job_id=document["job"]["id"] if document.get("job") else None,
        )

        pg_session.add(sample)
        await pg_session.flush()

        self._add_legacy_sample_join_rows(
            pg_session,
            sample.id,
            document["labels"],
            document["subtractions"],
        )

        for index, upload in enumerate(document["uploads"]):
            pg_session.add(
                SQLSampleUpload(
                    sample=document["_id"],
                    sample_id=sample.id,
                    upload_id=upload["id"],
                    index=index,
                ),
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
        space_id: int,
        _id: str | None = None,
    ) -> Sample:
        """Create a sample."""
        settings = await self.data.settings.get_all()

        await wait_for_checks(
            check_name_is_in_use(self._mongo, data.name),
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

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            sample_id = _id or await get_new_id(
                self._mongo.samples, session=mongo_session
            )

            await self.data.uploads.reserve(data.files, pg_session)

            # Create the job inside the sample's transaction so the job and its
            # sample commit atomically. The job's ``sample_id`` argument is
            # derived from ``legacy_samples.job_id`` on read, so the job must not
            # become claimable before its sample row exists.
            job_id = await self.data.jobs.create_in_session(
                pg_session,
                "create_sample",
                {"sample_id": sample_id},
                user_id,
            )

            document = await self._mongo.samples.insert_one(
                {
                    "_id": sample_id,
                    "all_read": settings.sample_all_read,
                    "all_write": settings.sample_all_write,
                    "created_at": virtool.utils.timestamp(),
                    "format": "fastq",
                    "group": group,
                    "group_read": settings.sample_group_read,
                    "group_write": settings.sample_group_write,
                    "hold": True,
                    "host": data.host,
                    "is_legacy": False,
                    "isolate": data.isolate,
                    "job": {"id": job_id},
                    "labels": data.labels,
                    "library_type": data.library_type,
                    "locale": data.locale,
                    "name": data.name,
                    "notes": data.notes,
                    # ``nuvs``, ``pathoscope`` and ``workflows`` are now derived on
                    # read and no longer maintained here. Their initial values are
                    # still written so replicas from the previous release, which
                    # read these fields directly, do not 500 on samples created
                    # mid rolling-deploy. Remove once every reader derives on read.
                    "nuvs": False,
                    "pathoscope": False,
                    "paired": len(uploads) == 2,
                    "quality": None,
                    "ready": False,
                    "results": None,
                    "space": {"id": space_id},
                    "subtractions": data.subtractions,
                    "uploads": [{"id": upload["id"]} for upload in uploads],
                    "user": {"id": user_id},
                    "workflows": define_initial_workflows(data.library_type),
                },
                session=mongo_session,
            )

            await self._write_legacy_sample(pg_session, document)

        emit(await self.data.jobs.get(job_id), "jobs", "create", Operation.CREATE)

        return await self.get(document["_id"])

    @emits(Operation.DELETE)
    async def delete(self, sample_id: int | str) -> Sample:
        """Delete the sample identified by ``sample_id`` and all its analyses.

        :param sample_id: the id of the sample to delete
        :return: the mongodb deletion result

        """
        resolved = await self._resolve_ids(sample_id)

        if resolved is None:
            raise ResourceNotFoundError

        sample_pk, legacy_id = resolved

        sample = await self.get(sample_id)

        upload_ids = [upload.id for upload in sample.uploads or []]

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            result = await self._mongo.samples.delete_one(
                {"_id": legacy_id}, session=mongo_session
            )
            await self._mongo.analyses.delete_many(
                {"sample.id": legacy_id},
                session=mongo_session,
            )

            if upload_ids:
                await pg_session.execute(
                    update(SQLUpload)
                    .where(SQLUpload.id.in_(upload_ids))
                    .values(reserved=False),
                )

            await pg_session.execute(
                delete(SQLAnalysisResult).where(
                    SQLAnalysisResult.analysis_id.in_(
                        select(SQLAnalysis.legacy_id).where(
                            SQLAnalysis.sample_id == sample_pk,
                        ),
                    ),
                ),
            )
            await pg_session.execute(
                delete(SQLAnalysis).where(
                    SQLAnalysis.sample_id == sample_pk,
                ),
            )

            await pg_session.execute(
                delete(SQLLegacySampleLabel).where(
                    SQLLegacySampleLabel.sample_id == sample_pk,
                ),
            )
            await pg_session.execute(
                delete(SQLLegacySampleSubtraction).where(
                    SQLLegacySampleSubtraction.sample_id == sample_pk,
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
                delete(SQLSampleArtifact).where(
                    or_(
                        SQLSampleArtifact.sample_id == sample_pk,
                        SQLSampleArtifact.sample == legacy_id,
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
            await pg_session.execute(
                delete(SQLLegacySample).where(
                    SQLLegacySample.id == sample_pk,
                ),
            )

        if result.deleted_count:
            for key, exc in await delete_prefix(
                self._storage, sample_prefix(legacy_id)
            ):
                logger.error(
                    "storage cleanup failed; file orphaned",
                    sample_id=legacy_id,
                    key=key,
                    error=repr(exc),
                )

            return sample

        raise ResourceNotFoundError

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

        sample_pk, legacy_id = resolved

        if await get_one_field(self._mongo.samples, "ready", legacy_id):
            raise ResourceConflictError("Sample already finalized")

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            result: UpdateResult = await self._mongo.samples.update_one(
                {"_id": legacy_id},
                {"$set": {"quality": quality, "ready": True}},
                session=mongo_session,
            )

            if not result.modified_count:
                raise ResourceNotFoundError

            await pg_session.execute(
                update(SQLLegacySample)
                .where(SQLLegacySample.id == sample_pk)
                .values(quality=quality, ready=True),
            )

        names_on_disk = []

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
                names_on_disk.append(row.name_on_disk)

                row.removed = True
                row.removed_at = virtool.utils.timestamp()
                session.add(row)

            await session.commit()

        await gather(
            *[self._storage.delete(upload_file_key(name)) for name in names_on_disk],
        )

        return await self.get(sample_id)

    @emits(Operation.UPDATE)
    async def update(self, sample_id: int | str, data: UpdateSampleRequest) -> Sample:
        """Update the sample identified by ``sample_id``.

        :param sample_id: the id of the sample to update
        :param data: the update data
        :return: the updated sample

        """
        resolved = await self._resolve_ids(sample_id)

        if resolved is None:
            raise ResourceNotFoundError

        sample_pk, legacy_id = resolved

        data = data.dict(exclude_unset=True)

        aws = []

        if "name" in data:
            aws.append(
                check_name_is_in_use(self._mongo, data["name"], sample_id=legacy_id),
            )

        if "labels" in data:
            aws.append(check_labels_do_not_exist(self._pg, data["labels"]))

        if "subtractions" in data:
            aws.append(
                check_subtractions_do_not_exist(self._pg, data["subtractions"]),
            )

        await wait_for_checks(*aws)

        scalars = {
            key: data[key]
            for key in ("name", "host", "isolate", "locale", "notes")
            if key in data
        }

        async def apply(mongo_session, pg_session) -> None:
            await self._mongo.samples.update_one(
                {"_id": legacy_id},
                {"$set": data},
                session=mongo_session,
            )

            if scalars:
                await pg_session.execute(
                    update(SQLLegacySample)
                    .where(SQLLegacySample.id == sample_pk)
                    .values(**scalars),
                )

            if "labels" not in data and "subtractions" not in data:
                return

            if "labels" in data:
                await pg_session.execute(
                    delete(SQLLegacySampleLabel).where(
                        SQLLegacySampleLabel.sample_id == sample_pk,
                    ),
                )

            if "subtractions" in data:
                await pg_session.execute(
                    delete(SQLLegacySampleSubtraction).where(
                        SQLLegacySampleSubtraction.sample_id == sample_pk,
                    ),
                )

            self._add_legacy_sample_join_rows(
                pg_session,
                sample_pk,
                data.get("labels", []),
                data.get("subtractions", []),
            )

        await retry_both_transactions(self._mongo, self._pg, apply)

        return await self.get(sample_id)

    async def get_owner_id(self, sample_id: int | str) -> int | None:
        """Return the owner user id of a sample, or ``None`` if it does not exist.

        :param sample_id: the id of the sample
        :return: the owner user id
        """
        async with AsyncSession(self._pg) as session:
            return (
                await session.execute(
                    select(SQLLegacySample.user_id).where(
                        compose_legacy_id_single_expression(SQLLegacySample, sample_id),
                    ),
                )
            ).scalar_one_or_none()

    async def update_rights(self, sample_id: int | str, data: dict[str, Any]) -> Sample:
        """Update the rights settings of the sample identified by ``sample_id``.

        :param sample_id: the id of the sample to update
        :param data: the rights fields to update
        :return: the updated sample
        """
        resolved = await self._resolve_ids(sample_id)

        if resolved is None:
            raise ResourceNotFoundError

        sample_pk, legacy_id = resolved

        group_id = None

        if "group" in data and data["group"] is not None:
            group = data["group"]

            async with AsyncSession(self._pg) as session:
                group_id = (
                    await session.execute(
                        select(SQLGroup.id).where(
                            SQLGroup.id == group
                            if isinstance(group, int)
                            else SQLGroup.legacy_id == group,
                        ),
                    )
                ).scalar_one_or_none()

            if group_id is None:
                raise ResourceConflictError("Group does not exist")

        scalars = {
            key: data[key]
            for key in ("all_read", "all_write", "group_read", "group_write")
            if key in data
        }

        if "group" in data:
            scalars["group_id"] = group_id
            data["group"] = group_id

        async def apply(mongo_session, pg_session) -> None:
            result = await self._mongo.samples.update_one(
                {"_id": legacy_id},
                {"$set": data},
                session=mongo_session,
            )

            if not result.matched_count:
                raise ResourceNotFoundError

            if scalars:
                await pg_session.execute(
                    update(SQLLegacySample)
                    .where(SQLLegacySample.id == sample_pk)
                    .values(**scalars),
                )

        await retry_both_transactions(self._mongo, self._pg, apply)

        return await self.get(sample_id)

    async def has_right(
        self,
        sample_id: int | str,
        client: UserClient,
        right: SampleRight,
    ) -> bool:
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(
                        SQLLegacySample.all_read,
                        SQLLegacySample.all_write,
                        SQLLegacySample.group_read,
                        SQLLegacySample.group_write,
                        SQLLegacySample.group_id,
                        SQLLegacySample.user_id,
                    ).where(
                        compose_legacy_id_single_expression(
                            SQLLegacySample,
                            sample_id,
                        ),
                    ),
                )
            ).first()

        if row is None:
            return True

        if (
            client.administrator_role == AdministratorRole.FULL
            or client.user_id == row.user_id
        ):
            return True

        is_group_member = False

        if row.group_id is not None:
            member_group_ids = await self._resolve_client_group_ids(client)
            is_group_member = row.group_id in member_group_ids

        if right == SampleRight.read:
            return row.all_read or (is_group_member and row.group_read)

        if right == SampleRight.write:
            return row.all_write or (is_group_member and row.group_write)

        raise ValueError(f"Invalid sample right: {right}")

    async def has_resources_for_analysis_job(self, ref_id, subtractions) -> None:
        """Checks that resources for analysis job exist.
        :param ref_id: the reference id
        :param subtractions: list of subtractions
        """
        reference = await self._mongo.references.find_one(
            {"_id": ref_id},
            ["archived"],
        )

        if reference is None:
            raise ResourceConflictError("Reference does not exist")

        if reference.get("archived"):
            raise ResourceConflictError("Reference is archived")

        if not await self._mongo.indexes.count_documents(
            {
                "reference.id": await compose_reference_id_match(self._pg, ref_id),
                "ready": True,
            },
        ):
            raise ResourceConflictError("No ready index")

        if subtractions is not None:
            non_existent_subtractions = await get_missing_subtraction_ids(
                self._pg,
                subtractions,
            )

            if non_existent_subtractions:
                raise ResourceConflictError(
                    f"Subtractions do not exist: "
                    f"{','.join(str(s) for s in non_existent_subtractions)}",
                )

    async def upload_artifact(
        self,
        sample_id: str,
        artifact_type: str | None,
        filename: str,
        chunker: AsyncGenerator[bytearray],
    ) -> dict:
        if artifact_type and artifact_type not in ArtifactType.to_list():
            raise ResourceConflictError("Unsupported sample artifact type")

        try:
            artifact = await create_artifact_file(
                self._pg,
                filename,
                filename,
                sample_id,
                artifact_type,
            )
        except exc.IntegrityError:
            raise ResourceConflictError(
                "Artifact file has already been uploaded for this sample",
            )

        key = sample_file_key(sample_id, filename)

        try:
            size = await self._storage.write(key, chunker)
        except (CancelledError, Exception):
            await delete_row(self._pg, artifact["id"], SQLSampleArtifact)
            await self._storage.delete(key)
            raise

        return await virtool.uploads.db.finalize(
            self._pg,
            size,
            artifact["id"],
            SQLSampleArtifact,
        )

    async def upload_reads(
        self,
        sample_id: str,
        filename: str,
        chunker: AsyncGenerator[bytearray],
        upload_id: int | None = None,
    ) -> dict:
        key = sample_file_key(sample_id, filename)

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
                sample_id,
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

        key = sample_file_key(row.sample, filename)

        return self._storage.read(key), row.size, filename

    async def get_artifact_file(
        self,
        sample_id: int | str,
        filename: str,
    ) -> tuple[AsyncIterator[bytes], int]:
        async with AsyncSession(self._pg) as session:
            result = (
                await session.execute(
                    select(SQLSampleArtifact).where(
                        SQLSampleArtifact.sample_id
                        == compose_legacy_id_subquery(SQLLegacySample, sample_id),
                        SQLSampleArtifact.name == filename,
                    ),
                )
            ).scalar()

        if not result:
            raise ResourceNotFoundError

        artifact = result.to_dict()
        key = sample_file_key(result.sample, artifact["name_on_disk"])

        return self._storage.read(key), result.size
