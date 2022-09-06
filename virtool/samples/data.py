import asyncio
import math
from typing import List, Optional

import virtool_core.utils
from motor.motor_asyncio import AsyncIOMotorClientSession
from pymongo.results import UpdateResult
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.samples import SampleSearchResult, Sample

import virtool.uploads.db
import virtool.utils
from virtool.api.utils import compose_regex_query
from virtool.config.cls import Config
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.piece import DataLayerPiece
from virtool.http.client import UserClient
from virtool.jobs.utils import JobRights
from virtool.labels.db import AttachLabelsTransform
from virtool.mongo.transforms import apply_transforms
from virtool.mongo.utils import get_new_id, get_one_field
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
)
from virtool.samples.oas import CreateSampleSchema, EditSampleSchema
from virtool.samples.utils import SampleRight, join_sample_path
from virtool.subtractions.db import AttachSubtractionTransform
from virtool.uploads.db import reserve
from virtool.users.db import AttachUserTransform
from virtool.utils import base_processor, run_in_thread, wait_for_checks


class SamplesData(DataLayerPiece):
    def __init__(self, config: Config, db, pg: AsyncEngine):
        self._config = config
        self._db = db
        self._pg = pg

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

        cursor = self._db.samples.find(
            search_query, LIST_PROJECTION, sort=[("created_at", -1)]
        )

        found_count, total_count = await asyncio.gather(
            self._db.samples.count_documents(search_query),
            self._db.samples.count_documents(base_query),
        )

        if page > 1:
            cursor.skip((page - 1) * per_page)

        documents = await apply_transforms(
            [
                base_processor(document)
                for document in await asyncio.shield(cursor.to_list(per_page))
            ],
            [AttachLabelsTransform(self._pg), AttachUserTransform(self._db)],
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
        document = await self._db.samples.find_one({"_id": sample_id})

        if not document:
            raise ResourceNotFoundError

        document["caches"] = [
            base_processor(cache)
            async for cache in self._db.caches.find({"sample.id": sample_id})
        ]

        document = await apply_transforms(
            base_processor(document),
            [
                ArtifactsAndReadsTransform(self._pg),
                AttachLabelsTransform(self._pg),
                AttachSubtractionTransform(self._db),
                AttachUserTransform(self._db),
            ],
        )

        document["paired"] = len(document["reads"]) == 2

        return Sample(**document)

    async def create(
        self,
        data: CreateSampleSchema,
        user_id: str,
        _id: Optional[str] = None,
    ) -> Sample:
        """
        Create a sample.

        """
        settings = await self.data.settings.get_all()

        await wait_for_checks(
            check_name_is_in_use(self._db, settings, data.name),
            check_labels_do_not_exist(self._pg, data.labels),
            check_subtractions_do_not_exist(self._db, data.subtractions),
        )

        try:
            uploads = [
                (await virtool.uploads.db.get(self._pg, file_)).to_dict()
                for file_ in data.files
            ]
        except AttributeError:
            raise ResourceConflictError("File does not exist")

        group = "none"

        # Require a valid ``group`` field if the ``sample_group`` setting is
        # ``users_primary_group``.
        if settings.sample_group == "force_choice":
            if force_choice_error_message := await validate_force_choice_group(
                self._db, data.dict(exclude_unset=True)
            ):
                raise ResourceConflictError(force_choice_error_message)

            group = data.group

        # Assign the user's primary group as the sample owner group if the
        # setting is ``users_primary_group``.
        elif settings.sample_group == "users_primary_group":
            group = await get_one_field(self._db.users, "primary_group", user_id)

        async with self._db.create_session() as session:
            document, _ = await asyncio.gather(
                self._db.samples.insert_one(
                    {
                        "_id": _id
                        or await get_new_id(self._db.samples, session=session),
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
                        "subtractions": data.subtractions,
                        "user": {"id": user_id},
                    },
                    session=session,
                ),
                reserve(self._pg, data.files),
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
            JobRights(),
        )

        return await self.get(sample_id)

    async def _update_with_session(
        self, session: AsyncIOMotorClientSession, sample_id: str, data: EditSampleSchema
    ) -> UpdateResult:
        data = data.dict(exclude_unset=True)

        settings = await self.data.settings.get_all()

        aws = []

        if "name" in data:
            aws.append(
                check_name_is_in_use(
                    self._db,
                    settings,
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
                    self._db, data["subtractions"], session=session
                )
            )

        await wait_for_checks(*aws)

        return await self._db.samples.update_one(
            {"_id": sample_id}, {"$set": data}, session=session
        )

    async def update(self, sample_id: str, data: EditSampleSchema) -> Sample:
        async with self._db.with_session() as session:
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
        async with self._db.create_session() as session:
            result, _ = await asyncio.gather(
                self._db.samples.delete_many({"_id": sample_id}, session=session),
                self._db.analyses.delete_many(
                    {"sample.id": sample_id}, session=session
                ),
            )

        if result.deleted_count:
            await run_in_thread(
                virtool_core.utils.rm,
                join_sample_path(self._config, sample_id),
                recursive=True,
            )

            return result

        raise ResourceNotFoundError

    async def has_right(
        self, sample_id: str, client: UserClient, right: SampleRight
    ) -> bool:
        document = await self._db.samples.find_one(
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
