"""The sample data layer domain."""

import asyncio
import math
from asyncio import gather, to_thread
from typing import Any

from pymongo.results import UpdateResult
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
import virtool_core.utils
from virtool.api.client import UserClient
from virtool.api.utils import compose_regex_query
from virtool.config.cls import Config
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emits
from virtool.data.topg import compose_legacy_id_expression
from virtool.data.transforms import apply_transforms
from virtool.groups.pg import SQLGroup
from virtool.jobs.client import JobsClient
from virtool.jobs.transforms import AttachJobTransform
from virtool.labels.transforms import AttachLabelsTransform
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_new_id, get_one_field
from virtool.samples.checks import (
    check_labels_do_not_exist,
    check_name_is_in_use,
    check_subtractions_do_not_exist,
)
from virtool.samples.db import (
    AttachArtifactsAndReadsTransform,
    compose_sample_workflow_query,
    define_initial_workflows,
    recalculate_workflow_tags,
)
from virtool.samples.models import Sample, SampleSearchResult
from virtool.samples.oas import CreateSampleRequest, UpdateSampleRequest
from virtool.samples.sql import SQLSampleReads
from virtool.samples.utils import SampleRight, join_sample_path
from virtool.subtractions.db import (
    AttachSubtractionsTransform,
)
from virtool.uploads.sql import SQLUpload
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor, chunk_list, wait_for_checks
from virtool_core.models.roles import AdministratorRole


class SamplesData(DataLayerDomain):
    name = "samples"

    def __init__(
        self,
        config: Config,
        mongo: Mongo,
        pg: AsyncEngine,
        jobs_client: JobsClient,
    ):
        self._config = config
        self._mongo = mongo
        self._pg = pg
        self.jobs_client = jobs_client

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
            # The requesting user is the sample owner
            {"user.id": client.user_id},
            # The sample rights allow all users to view the sample.
            {"all_read": True},
        ]

        if client.groups:
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    select(SQLGroup).where(
                        compose_legacy_id_expression(SQLGroup, client.groups),
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
                        "data": {
                            item: True
                            for item in (
                                "_id",
                                "created_at",
                                "host",
                                "isolate",
                                "job",
                                "library_type",
                                "pathoscope",
                                "name",
                                "nuvs",
                                "ready",
                                "user",
                                "notes",
                                "labels",
                                "subtractions",
                                "workflows",
                            )
                        },
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
                AttachLabelsTransform(self._pg),
                AttachUserTransform(self._mongo),
                AttachJobTransform(self._mongo),
            ],
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

        TODO: Return `None` for unset group instead of `"none"`.

        :param sample_id: the id of the sample
        :return: the sample
        :raises ResourceNotFoundError: when the sample does not exist
        """
        document = await self._mongo.samples.find_one({"_id": sample_id})

        if document is None:
            raise ResourceNotFoundError()

        document = await apply_transforms(
            base_processor(document),
            [
                AttachArtifactsAndReadsTransform(self._pg),
                AttachJobTransform(self._mongo),
                AttachLabelsTransform(self._pg),
                AttachSubtractionsTransform(self._mongo),
                AttachUserTransform(self._mongo),
            ],
        )

        return Sample(**{**document, "paired": len(document["reads"]) == 2})

    @emits(Operation.CREATE)
    async def create(
        self,
        data: CreateSampleRequest,
        user_id: str,
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
            group = await get_one_field(self._mongo.users, "primary_group", user_id)

            if isinstance(group, str):
                async with AsyncSession(self._pg) as session:
                    group = await session.execute(
                        select(SQLGroup).where(SQLGroup.legacy_id == group),
                    )

                    group = group.scalar_one().id

            if not group:
                group = None

        async with self._mongo.create_session() as session:
            job_id = await get_new_id(self._mongo.jobs, session=session)

            document, _ = await asyncio.gather(
                self._mongo.samples.insert_one(
                    {
                        "_id": _id
                        or await get_new_id(self._mongo.samples, session=session),
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
                        "nuvs": False,
                        "paired": len(uploads) == 2,
                        "pathoscope": False,
                        "quality": None,
                        "ready": False,
                        "results": None,
                        "space": {"id": space_id},
                        "subtractions": data.subtractions,
                        "user": {"id": user_id},
                        "workflows": define_initial_workflows(data.library_type),
                    },
                    session=session,
                ),
                self.data.uploads.reserve(data.files),
            )

            sample_id = document["_id"]

            await self.data.jobs.create(
                "create_sample",
                {
                    "sample_id": sample_id,
                    "files": [
                        {
                            "id": upload["id"],
                            "name": upload["name"],
                            "size": upload["size"],
                        }
                        for upload in uploads
                    ],
                },
                user_id,
                job_id=job_id,
            )

        return await self.get(sample_id)

    @emits(Operation.DELETE)
    async def delete(self, sample_id: str) -> Sample:
        """Deletes the sample identified by ``sample_id`` and all its analyses.

        :param sample_id: the id of the sample to delete
        :return: the mongodb deletion result

        """
        sample = await self.get(sample_id)

        async with self._mongo.create_session() as session:
            result, _ = await asyncio.gather(
                self._mongo.samples.delete_many({"_id": sample_id}, session=session),
                self._mongo.analyses.delete_many(
                    {"sample.id": sample_id},
                    session=session,
                ),
            )

        if result.deleted_count:
            try:
                await to_thread(
                    virtool_core.utils.rm,
                    join_sample_path(self._config, sample_id),
                    recursive=True,
                )
            except FileNotFoundError:
                pass

            return sample

        raise ResourceNotFoundError

    @emits(Operation.UPDATE, name="finalize")
    async def finalize(
        self,
        sample_id: str,
        quality: dict[str, Any],
    ) -> Sample:
        """Finalize a sample by setting a ``quality`` field and ``ready`` to ``True``

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
                row.reads.clear()
                row.removed = True
                row.removed_at = virtool.utils.timestamp()

                try:
                    await to_thread(
                        virtool_core.utils.rm,
                        self._config.data_path / "files" / row.name_on_disk,
                    )
                except FileNotFoundError:
                    pass

                session.add(row)

            await session.commit()

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
            ["all_read", "all_write", "group", "group_read", "user"],
        )

        if document is None:
            return True

        if (
            client.administrator_role == AdministratorRole.FULL
            or client.user_id == document["user"]["id"]
        ):
            return True

        is_group_member = bool(document["group"] and document["group"] in client.groups)

        if right == SampleRight.read:
            return document["all_read"] or (is_group_member and document["group_read"])

        if right == SampleRight.write:
            return document["all_write"] or (
                is_group_member and document["group_write"]
            )

        raise ValueError(f"Invalid sample right: {right}")

    async def has_resources_for_analysis_job(self, ref_id, subtractions):
        """Checks that resources for analysis job exist.
        :param ref_id: the reference id
        :param subtractions: list of subtractions
        """
        if not await self._mongo.references.count_documents({"_id": ref_id}):
            raise ResourceConflictError("Reference does not exist")

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

    async def update_sample_workflows(self):
        sample_ids = await self._mongo.samples.distinct("_id")

        for chunk in chunk_list(sample_ids, 50):
            await gather(
                *[
                    recalculate_workflow_tags(self._mongo, sample_id)
                    for sample_id in chunk
                ],
            )
