"""The sample data layer domain."""

import asyncio
import math
from asyncio import CancelledError, gather
from collections.abc import AsyncGenerator, AsyncIterator
from typing import Any

from pymongo.results import UpdateResult
from sqlalchemy import delete, exc, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.uploads.db
import virtool.utils
from virtool.analyses.sql import SQLAnalysis, SQLAnalysisResult
from virtool.api.client import UserClient
from virtool.api.utils import compose_regex_query
from virtool.config.cls import Config
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emits
from virtool.data.topg import both_transactions, compose_legacy_id_multi_expression
from virtool.data.transforms import apply_transforms
from virtool.groups.models import GroupMinimal
from virtool.groups.pg import SQLGroup
from virtool.jobs.transforms import AttachJobTransform
from virtool.labels.transforms import AttachLabelsTransform
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_new_id, get_one_field
from virtool.pg.utils import delete_row
from virtool.samples.checks import (
    check_labels_do_not_exist,
    check_name_is_in_use,
    check_subtractions_do_not_exist,
)
from virtool.samples.db import (
    AttachArtifactsAndReadsTransform,
    AttachUploadsTransform,
    compose_sample_workflow_query,
    define_initial_workflows,
    recalculate_workflow_tags,
)
from virtool.samples.files import (
    create_artifact_file,
    create_reads_file,
)
from virtool.samples.models import Sample, SampleSearchResult
from virtool.samples.oas import CreateSampleRequest, UpdateSampleRequest
from virtool.samples.sql import ArtifactType, SQLSampleArtifact, SQLSampleReads
from virtool.samples.utils import SampleRight, sample_file_key, sample_prefix
from virtool.storage.cleanup import delete_prefix
from virtool.storage.protocol import StorageBackend
from virtool.subtractions.db import (
    AttachSubtractionsTransform,
)
from virtool.uploads.sql import SQLUpload
from virtool.uploads.utils import is_gzip_compressed, upload_file_key
from virtool.users.pg import SQLUser
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor, chunk_list, wait_for_checks

logger = get_logger("samples")


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
        queries = []

        if term:
            queries.append(compose_regex_query(term, ["name", "user.id"]))

        if labels:
            queries.append({"labels": {"$in": labels}})

        if workflows:
            queries.append(compose_sample_workflow_query(workflows))

        query = {}

        if queries:
            query["$and"] = queries

        rights_filter = [
            {"all_read": True},
            {"user.id": client.user_id},
        ]

        if client.groups:
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    select(SQLGroup).where(
                        compose_legacy_id_multi_expression(SQLGroup, client.groups),
                    ),
                )

                group_ids = []

                for group in result.scalars().all():
                    group_ids.append(group.id)

                    if group.legacy_id is not None:
                        group_ids.append(group.legacy_id)

            # The sample rights allow owner group members to view the sample and the
            # requesting user is a member of the owner group.
            rights_filter.append({"group_read": True, "group": {"$in": group_ids}})

        search_query = {"$and": [{"$or": rights_filter}, query]}

        skip_count = 0

        if page > 1:
            skip_count = (page - 1) * per_page

        found_count = 0
        total_count = 0

        async for paginate_dict in self._mongo.samples.aggregate(
            [
                {
                    "$facet": {
                        "total_count": [{"$count": "total_count"}],
                        "found_count": [
                            {"$match": search_query},
                            {"$count": "found_count"},
                        ],
                        "data": [
                            {"$match": search_query},
                            {"$sort": {"created_at": -1}},
                            {"$skip": skip_count},
                            {"$limit": per_page},
                        ],
                    },
                },
                {
                    "$project": {
                        "data": dict.fromkeys(
                            (
                                "_id",
                                "created_at",
                                "host",
                                "isolate",
                                "job",
                                "library_type",
                                "pathoscope",
                                "name",
                                "notes",
                                "nuvs",
                                "ready",
                                "subtractions",
                                "uploads",
                                "user",
                                "workflows",
                                "labels",
                            ),
                            True,
                        ),
                        "total_count": {
                            "$arrayElemAt": ["$total_count.total_count", 0],
                        },
                        "found_count": {
                            "$arrayElemAt": ["$found_count.found_count", 0],
                        },
                    },
                },
            ],
        ):
            data = paginate_dict["data"]
            found_count = paginate_dict.get("found_count", 0)
            total_count = paginate_dict.get("total_count", 0)

        documents = await apply_transforms(
            [base_processor(d) for d in data],
            [
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

    async def get(self, sample_id: str) -> Sample:
        """Get a sample by its id.

        :param sample_id: the id of the sample
        :return: the sample
        :raises ResourceNotFoundError: when the sample does not exist
        """
        document = await self._mongo.samples.find_one({"_id": sample_id})

        if document is None:
            raise ResourceNotFoundError

        document = await apply_transforms(
            base_processor(document),
            [
                AttachArtifactsAndReadsTransform(self._pg),
                AttachJobTransform(self._pg),
                AttachLabelsTransform(self._pg),
                AttachSubtractionsTransform(self._mongo),
                AttachUploadsTransform(self._pg),
                AttachUserTransform(self._pg),
            ],
            self._pg,
        )

        group = None

        if document["group"] == "none":
            document["group"] = None

        if document["group"] is not None:
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    select(SQLGroup).where(
                        compose_legacy_id_multi_expression(
                            SQLGroup, [document["group"]]
                        ),
                    ),
                )

                row = result.scalar_one_or_none()

            if row:
                group = GroupMinimal(
                    id=row.id,
                    name=row.name,
                    legacy_id=row.legacy_id,
                )

        return Sample(
            **{
                **document,
                "group": group,
                "paired": len(document["reads"]) == 2,
            }
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
            check_subtractions_do_not_exist(self._mongo, data.subtractions),
        )

        try:
            uploads = [
                (await self.data.uploads.get(file_)).dict() for file_ in data.files
            ]
        except ResourceNotFoundError:
            raise ResourceConflictError("File does not exist")

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

        async with self._mongo.create_session() as session:
            sample_id = _id or await get_new_id(self._mongo.samples, session=session)

            job = await self.data.jobs.create(
                "create_sample",
                {"sample_id": sample_id},
                user_id,
            )

            document, _ = await asyncio.gather(
                self._mongo.samples.insert_one(
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
                        "job": {"id": job.id},
                        "labels": data.labels,
                        "library_type": data.library_type,
                        "locale": data.locale,
                        "name": data.name,
                        "notes": data.notes,
                        "nuvs": False,
                        "paired": len(uploads) == 2,
                        "pathoscope": False,
                        "quality": None,
                        "ready": False,
                        "results": None,
                        "space": {"id": space_id},
                        "subtractions": data.subtractions,
                        "uploads": [{"id": upload["id"]} for upload in uploads],
                        "user": {"id": user_id},
                        "workflows": define_initial_workflows(data.library_type),
                    },
                    session=session,
                ),
                self.data.uploads.reserve(data.files),
            )

        return await self.get(document["_id"])

    @emits(Operation.DELETE)
    async def delete(self, sample_id: str) -> Sample:
        """Delete the sample identified by ``sample_id`` and all its analyses.

        :param sample_id: the id of the sample to delete
        :return: the mongodb deletion result

        """
        sample = await self.get(sample_id)

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            result = await self._mongo.samples.delete_one(
                {"_id": sample_id}, session=mongo_session
            )
            await self._mongo.analyses.delete_many(
                {"sample.id": sample_id},
                session=mongo_session,
            )

            await pg_session.execute(
                delete(SQLAnalysisResult).where(
                    SQLAnalysisResult.analysis_id.in_(
                        select(SQLAnalysis.legacy_id).where(
                            SQLAnalysis.sample == sample_id,
                        ),
                    ),
                ),
            )
            await pg_session.execute(
                delete(SQLAnalysis).where(SQLAnalysis.sample == sample_id),
            )

        if result.deleted_count:
            for key, exc in await delete_prefix(
                self._storage, sample_prefix(sample_id)
            ):
                logger.error(
                    "storage cleanup failed; file orphaned",
                    sample_id=sample_id,
                    key=key,
                    error=repr(exc),
                )

            return sample

        raise ResourceNotFoundError

    @emits(Operation.UPDATE, name="finalize")
    async def finalize(
        self,
        sample_id: str,
        quality: dict[str, Any],
    ) -> Sample:
        """Finalize a sample by setting a ``quality`` field and ``ready`` to ``True``.

        :param sample_id: the id of the sample
        :param quality: a dict containing quality data
        :return: the sample after finalizing
        """
        if await get_one_field(self._mongo.samples, "ready", sample_id):
            raise ResourceConflictError("Sample already finalized")

        result: UpdateResult = await self._mongo.samples.update_one(
            {"_id": sample_id},
            {"$set": {"quality": quality, "ready": True}},
        )

        if not result.modified_count:
            raise ResourceNotFoundError

        names_on_disk = []

        async with AsyncSession(self._pg) as session:
            rows = (
                (
                    await session.execute(
                        select(SQLUpload)
                        .where(SQLSampleReads.sample == sample_id)
                        .join_from(SQLSampleReads, SQLUpload),
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
    async def update(self, sample_id: str, data: UpdateSampleRequest) -> Sample:
        """Update the sample identified by ``sample_id``.

        :param sample_id: the id of the sample to update
        :param data: the update data
        :return: the updated sample

        """
        data = data.dict(exclude_unset=True)

        aws = []

        if "name" in data:
            aws.append(
                check_name_is_in_use(self._mongo, data["name"], sample_id=sample_id),
            )

        if "labels" in data:
            aws.append(check_labels_do_not_exist(self._pg, data["labels"]))

        if "subtractions" in data:
            aws.append(
                check_subtractions_do_not_exist(self._mongo, data["subtractions"]),
            )

        await wait_for_checks(*aws)

        await self._mongo.samples.update_one({"_id": sample_id}, {"$set": data})

        return await self.get(sample_id)

    async def has_right(
        self,
        sample_id: str,
        client: UserClient,
        right: SampleRight,
    ) -> bool:
        document = await self._mongo.samples.find_one(
            {"_id": sample_id},
            ["all_read", "all_write", "group", "group_read", "group_write", "user"],
        )

        if document is None:
            return True

        if (
            client.administrator_role == AdministratorRole.FULL
            or client.user_id == document["user"]["id"]
        ):
            return True

        # Handle both None and "none" during the transition period
        group = document["group"]
        if group == "none":
            group = None

        is_group_member = bool(group and group in client.groups)

        if right == SampleRight.read:
            return document["all_read"] or (is_group_member and document["group_read"])

        if right == SampleRight.write:
            return document["all_write"] or (
                is_group_member and document["group_write"]
            )

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
            {"reference.id": ref_id, "ready": True},
        ):
            raise ResourceConflictError("No ready index")

        if subtractions is not None:
            non_existent_subtractions = await virtool.mongo.utils.check_missing_ids(
                self._mongo.subtraction,
                subtractions,
            )

            if non_existent_subtractions:
                raise ResourceConflictError(
                    f"Subtractions do not exist: {','.join(non_existent_subtractions)}",
                )

    async def update_sample_workflows(self) -> None:
        sample_ids = await self._mongo.samples.distinct("_id")

        for chunk in chunk_list(sample_ids, 50):
            await gather(
                *[
                    recalculate_workflow_tags(self._mongo, sample_id)
                    for sample_id in chunk
                ],
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

        async def _validate_and_stream() -> AsyncIterator[bytearray]:
            first = True
            async for chunk in chunker:
                if first:
                    is_gzip_compressed(chunk)
                    first = False
                yield chunk

        size = await self._storage.write(key, _validate_and_stream())

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
        sample_id: str,
        filename: str,
    ) -> tuple[AsyncIterator[bytes], int, str]:
        if not await self._mongo.samples.find_one(sample_id):
            raise ResourceNotFoundError

        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLSampleReads).filter_by(
                        sample=sample_id,
                        name=filename,
                    ),
                )
            ).scalar()

        if row is None:
            raise ResourceNotFoundError

        key = sample_file_key(sample_id, filename)

        return self._storage.read(key), row.size, filename

    async def get_artifact_file(
        self,
        sample_id: str,
        filename: str,
    ) -> tuple[AsyncIterator[bytes], int]:
        if not await self._mongo.samples.find_one(sample_id):
            raise ResourceNotFoundError

        async with AsyncSession(self._pg) as session:
            result = (
                await session.execute(
                    select(SQLSampleArtifact).filter_by(
                        sample=sample_id,
                        name=filename,
                    ),
                )
            ).scalar()

        if not result:
            raise ResourceNotFoundError

        artifact = result.to_dict()
        key = sample_file_key(sample_id, artifact["name_on_disk"])

        return self._storage.read(key), result.size
