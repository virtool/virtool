import asyncio
import logging
import math
from asyncio import to_thread
from typing import List, Optional

import virtool_core.utils
from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo.results import UpdateResult
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.analysis import AnalysisSearchResult
from virtool_core.models.samples import SampleSearchResult, Sample
from virtool.mongo.core import Mongo

import virtool.utils
from virtool.api.utils import compose_regex_query
from virtool.caches.db import lookup_caches
from virtool.config.cls import Config
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.piece import DataLayerPiece
from virtool.http.client import UserClient
from virtool.jobs.client import JobsClient
from virtool.jobs.db import lookup_minimal_job_by_id, create_job
from virtool.jobs.utils import JobRights
from virtool.labels.db import AttachLabelsTransform
from virtool.mongo.migrate import recalculate_all_workflow_tags
from virtool.mongo.transforms import apply_transforms
from virtool.mongo.utils import get_new_id, get_one_field
from virtool.references.db import lookup_nested_reference_by_id
from virtool.samples.checks import (
    check_labels_do_not_exist,
    check_subtractions_do_not_exist,
    check_name_is_in_use,
)
from virtool.samples.db import (
    compose_sample_workflow_query,
    LIST_PROJECTION,
    ArtifactsAndReadsTransform,
    validate_force_choice_group,
    define_initial_workflows,
    NameGenerator,
)
from virtool.samples.oas import CreateSampleRequest, UpdateSampleRequest
from virtool.samples.utils import SampleRight, join_sample_path
from virtool.subtractions.db import lookup_nested_subtractions
from virtool.tasks.progress import (
    AbstractProgressHandler,
    AccumulatingProgressHandlerWrapper,
)
from virtool.users.db import lookup_nested_user_by_id
from virtool.utils import base_processor, wait_for_checks

logger = logging.getLogger(__name__)


class SamplesData(DataLayerPiece):
    def __init__(self, config: Config, mongo: Mongo, pg: AsyncEngine, jobs_client: JobsClient):
        self._config = config
        self._mongo = mongo
        self._pg = pg
        self.jobs_client = jobs_client

    async def find(
        self,
        labels: List[int],
        page: int,
        per_page: int,
        term: str,
        workflows: List[str],
        client,
    ) -> SampleSearchResult:
        """
        Find and filter samples.
        """
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
            # The sample rights allow owner group members to view the sample and the
            # requesting user is a member of the owner group.
            rights_filter.append({"group_read": True, "group": {"$in": client.groups}})

        base_query = {"$or": rights_filter}

        search_query = {"$and": [base_query, query]}

        dict_projection = {item: True for item in LIST_PROJECTION}

        sort = {"created_at": -1}

        skip_count = 0

        if page > 1:
            skip_count = (page - 1) * per_page

        async for paginate_dict in self._mongo.samples.aggregate(
            [
                {
                    "$facet": {
                        "total_count": [
                            {"$count": "total_count"},
                        ],
                        "found_count": [
                            {"$match": search_query},
                            {"$count": "found_count"},
                        ],
                        "data": [
                            {
                                "$match": search_query,
                            },
                            {"$sort": sort},
                            {"$skip": skip_count},
                            {"$limit": per_page},
                            *lookup_nested_user_by_id(local_field="user.id"),
                        ],
                    }
                },
                {
                    "$project": {
                        "data": dict_projection,
                        "total_count": {
                            "$arrayElemAt": ["$total_count.total_count", 0]
                        },
                        "found_count": {
                            "$arrayElemAt": ["$found_count.found_count", 0]
                        },
                    }
                },
            ],
        ):
            data = paginate_dict["data"]
            found_count = paginate_dict.get("found_count", 0)
            total_count = paginate_dict.get("total_count", 0)

        documents = await apply_transforms(
            [base_processor(document) for document in data],
            [AttachLabelsTransform(self._pg)],
        )

        return SampleSearchResult(
            documents=documents,
            found_count=found_count,
            total_count=total_count,
            page=page,
            page_count=int(math.ceil(found_count / per_page)),
            per_page=per_page,
        )

    async def find_analyses(
        self, page: int, per_page: int, sample_id: str, term: Optional[str]
    ) -> AnalysisSearchResult:
        """
        Find all analyses with the given sample id.

        :param page: the page number
        :param per_page: the number of documents per page
        :param sample_id: the id of the sample
        :param term: the text to filter by reference name or user id in the sample
        :return: a list of all analysis documents
        """
        sort = {"created_at": -1}

        skip_count = 0

        if page > 1:
            skip_count = (page - 1) * per_page

        match_query = {
            "$and": [
                compose_regex_query(term, ["reference.name", "user.id"])
                if term
                else {},
                {"sample.id": sample_id},
            ]
        }

        async for paginate_dict in self._mongo.analyses.aggregate(
            [
                {
                    "$facet": {
                        "total_count": [
                            {"$count": "total_count"},
                        ],
                        "found_count": [
                            {"$match": match_query},
                            {"$count": "found_count"},
                        ],
                        "data": [
                            {"$match": match_query},
                            {"$sort": sort},
                            {"$skip": skip_count},
                            {"$limit": per_page},
                            *lookup_minimal_job_by_id(),
                            *lookup_nested_subtractions(),
                            *lookup_nested_reference_by_id(),
                            *lookup_nested_user_by_id(),
                        ],
                    }
                },
                {
                    "$project": {
                        "data": {
                            "_id": True,
                            "workflow": True,
                            "created_at": True,
                            "index": True,
                            "job": True,
                            "ready": True,
                            "reference": True,
                            "sample": True,
                            "subtractions": True,
                            "updated_at": True,
                            "user": True,
                        },
                        "total_count": {
                            "$arrayElemAt": ["$total_count.total_count", 0]
                        },
                        "found_count": {
                            "$arrayElemAt": ["$found_count.found_count", 0]
                        },
                    }
                },
            ],
        ):
            data = paginate_dict["data"]
            found_count = paginate_dict.get("found_count", 0)
            total_count = paginate_dict.get("total_count", 0)

        return AnalysisSearchResult(
            documents=data,
            found_count=found_count,
            total_count=total_count,
            page=page,
            page_count=int(math.ceil(found_count / per_page)),
            per_page=per_page,
        )

    async def get(self, sample_id: str) -> Sample:
        documents = await self._mongo.samples.aggregate(
            [
                {"$match": {"_id": sample_id}},
                *lookup_nested_user_by_id(local_field="user.id"),
                *lookup_nested_subtractions(local_field="subtractions"),
                *lookup_caches(local_field="_id"),
                *lookup_minimal_job_by_id(local_field="job.id")
            ]
        ).to_list(length=1)

        if len(documents) == 0:
            raise ResourceNotFoundError

        document = documents[0]

        document = await apply_transforms(
            base_processor(document),
            [
                ArtifactsAndReadsTransform(self._pg),
                AttachLabelsTransform(self._pg),
            ],
        )

        document["paired"] = len(document["reads"]) == 2

        return Sample(**document)

    async def create(
        self,
        data: CreateSampleRequest,
        user_id: str,
        space_id: int,
        _id: Optional[str] = None,
    ) -> Sample:
        """
        Create a sample.
        """
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

        group = "none"

        # Require a valid ``group`` field if the ``sample_group`` setting is
        # ``users_primary_group``.
        if settings.sample_group == "force_choice":
            if force_choice_error_message := await validate_force_choice_group(
                self._mongo, data.dict(exclude_unset=True)
            ):
                raise ResourceConflictError(force_choice_error_message)

            group = data.group

        # Assign the user's primary group as the sample owner group if the
        # setting is ``users_primary_group``.
        elif settings.sample_group == "users_primary_group":
            group = await get_one_field(self._mongo.users, "primary_group", user_id)

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
                        "hold": True,
                        "group_read": settings.sample_group_read,
                        "group_write": settings.sample_group_write,
                        "host": data.host,
                        "is_legacy": False,
                        "isolate": data.isolate,
                        "job": {
                            "id": job_id
                        },
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

            await create_job(
                mongo=self._mongo,
                client=self.jobs_client,
                workflow="create_sample",
                job_args={
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
                user_id=user_id,
                rights=JobRights(),
                space_id=0,
                job_id=job_id,
                session=session
            )

        return await self.get(sample_id)

    async def _update_with_session(
        self,
        session: AsyncIOMotorClientSession,
        sample_id: str,
        data: UpdateSampleRequest,
    ) -> UpdateResult:
        data = data.dict(exclude_unset=True)

        aws = []

        if "name" in data:
            aws.append(
                check_name_is_in_use(
                    self._mongo,
                    data["name"],
                    sample_id=sample_id,
                    session=session,
                )
            )

        if "labels" in data:
            aws.append(check_labels_do_not_exist(self._pg, data["labels"]))

        if "subtractions" in data:
            aws.append(
                check_subtractions_do_not_exist(
                    self._mongo, data["subtractions"], session=session
                )
            )

        await wait_for_checks(*aws)

        return await self._mongo.samples.update_one(
            {"_id": sample_id}, {"$set": data}, session=session
        )

    async def update(self, sample_id: str, data: UpdateSampleRequest) -> Sample:
        async with self._mongo.with_session() as session:
            await session.with_transaction(
                lambda s: self._update_with_session(s, sample_id, data)
            )

        return await self.get(sample_id)

    async def delete(self, sample_id: str):
        """
        Complete deletes the sample identified by the document ids in ``id_list``.

        Removes all analyses and samples in MongoDB, as well as all files from the data
        directory.

        :param sample_id: the id of the sample to delete
        :return: the mongodb deletion result

        """
        async with self._mongo.create_session() as session:
            result, _ = await asyncio.gather(
                self._mongo.samples.delete_many({"_id": sample_id}, session=session),
                self._mongo.analyses.delete_many(
                    {"sample.id": sample_id}, session=session
                ),
            )

        if result.deleted_count:
            await to_thread(
                virtool_core.utils.rm,
                join_sample_path(self._config, sample_id),
                recursive=True,
            )

            return result

        raise ResourceNotFoundError

    async def has_right(
        self, sample_id: str, client: UserClient, right: SampleRight
    ) -> bool:
        document = await self._mongo.samples.find_one(
            {"_id": sample_id}, ["all_read", "group", "group_read", "user"]
        )

        if document is None:
            return True

        if client.administrator or document["user"]["id"] == client.user_id:
            return True

        is_group_member = bool(document["group"] and document["group"] in client.groups)

        if right == SampleRight.read:
            return document["all_read"] or (is_group_member and document["group_read"])

        if right == SampleRight.write:
            return document["all_write"] or (
                is_group_member and document["group_write"]
            )

        raise ValueError(f"Invalid sample right: {right}")

    async def compress_samples(self, progress_handler: AbstractProgressHandler):
        query = {"is_legacy": True, "is_compressed": {"$exists": False}}

        count = await self._mongo.samples.count_documents(query)

        tracker = AccumulatingProgressHandlerWrapper(progress_handler, count)

        while True:
            sample = await self._mongo.samples.find_one(query)

            if sample is None:
                break

            await virtool.samples.db.compress_sample_reads(
                self._mongo, self._config, sample
            )
            await tracker.add(1)

    async def move_sample_files(self, progress_handler: AbstractProgressHandler):
        query = {
            "files": {"$exists": True},
            "$or": [{"is_legacy": False}, {"is_legacy": True, "is_compressed": True}],
        }

        count = await self._mongo.samples.count_documents(query)

        tracker = AccumulatingProgressHandlerWrapper(progress_handler, count)

        while True:
            sample = await self._mongo.samples.find_one(query)

            if sample is None:
                break

            await virtool.samples.db.move_sample_files_to_pg(self._mongo, self._pg, sample)
            await tracker.add(1)

    async def deduplicate_sample_names(self):
        """
        Find all samples with duplicate names in the same space and rename
        them with increasing integers by order of creation.
        """
        async with self._mongo.create_session() as session:
            async for duplicate_name_documents in self._mongo.samples.aggregate(
                [
                    {
                        "$group": {
                            "_id": {"name": "$name", "space_id": "$space_id"},
                            "count": {"$sum": 1},
                            "documents": {
                                "$push": {"_id": "$_id", "created_at": "$created_at"}
                            },
                        }
                    },
                    {"$match": {"count": {"$gt": 1}}},
                    {"$unwind": "$documents"},
                    {"$sort": {"documents.created_at": 1}},
                    {
                        "$group": {
                            "_id": "$_id",
                            "sample_ids": {"$push": "$documents._id"},
                        }
                    },
                    {
                        "$project": {
                            "name": "$_id.name",
                            "space_id": "$_id.space_id",
                            "_id": 0,
                            "sample_ids": 1,
                        }
                    },
                ],
                session=session,
            ):
                name_generator = NameGenerator(
                    self._mongo,
                    duplicate_name_documents["name"],
                    duplicate_name_documents.get("space_id", None),
                )

                for sample_id in duplicate_name_documents["sample_ids"][1:]:
                    await self._mongo.samples.update_one(
                        {"_id": sample_id},
                        {"$set": {"name": await name_generator.get(session)}},
                        session=session,
                    )

    async def update_sample_workflows(self):
        await recalculate_all_workflow_tags(self._mongo)
