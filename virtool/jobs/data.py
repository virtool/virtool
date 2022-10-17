import math
from asyncio import gather
from collections import defaultdict
from typing import Optional, Dict

from multidict import MultiDictProxy
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.job import (
    JobMinimal,
    JobSearchResult,
    JobStatus,
    Job, JobPing,
)
from virtool_core.models.user import UserNested

import virtool.utils
from virtool.api.utils import (
    compose_regex_query,
    get_query_bool,
)
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.mongo.core import DB
from virtool.mongo.transforms import apply_transforms
from virtool.mongo.utils import get_one_field
from virtool.jobs import is_running_or_waiting
from virtool.jobs.client import AbstractJobsClient, JOB_REMOVED_FROM_QUEUE
from virtool.jobs.db import OR_COMPLETE, OR_FAILED, PROJECTION, fetch_complete_job
from virtool.jobs.utils import JobRights, compose_status
from virtool.types import Document
from virtool.users.db import AttachUserTransform


class JobsData:
    def __init__(self, client: AbstractJobsClient, db: DB, pg: AsyncEngine):
        self._client = client
        self._db = db
        self._pg = pg

    async def _get_counts(
        self,
    ) -> Dict[str, Dict[str, int]]:
        counts = defaultdict(dict)

        async for a in self._db.jobs.aggregate(
            [
                {"$match": {"archived": False}},
                {"$addFields": {"last_status": {"$last": "$status"}}},
                {
                    "$group": {
                        "_id": {
                            "workflow": "$workflow",
                            "state": "$last_status.state",
                        },
                        "count": {"$sum": 1},
                    }
                },
            ]
        ):
            workflow = a["_id"]["workflow"]
            state = a["_id"]["state"]
            counts[state][workflow] = a["count"]

        return dict(counts)

    async def find(self, query: MultiDictProxy) -> JobSearchResult:
        """
        {
          "waiting": {
            "all": 23,
            "pathoscope": 12,
            "create_sample": 8,
            "nuvs": 3
          }
        }
        """
        states = query.getall("state", None)
        users = query.get("users")
        if users:
            users = [user.strip() for user in users.split(",")]
        archived = get_query_bool(query, "archived") if "archived" in query else None

        try:
            page = int(query["page"])
        except (KeyError, ValueError):
            page = 1

        try:
            per_page = int(query["per_page"])
        except (KeyError, ValueError):
            per_page = 25

        skip_count = 0

        if page > 1:
            skip_count = (page - 1) * per_page

        sort = {"created_at": -1}

        match_query = {
            **({"archived": archived} if archived is not None else {}),
            **({"user.id": {"$in": users}} if users else {})
        }

        match_state = {"state": {"$in": states}} if states else {}

        async for paginate_dict in self._db.jobs.aggregate(
            [
                {
                    "$facet": {
                        "total_count": [
                            {"$count": "total_count"},
                        ],
                        "found_count": [
                            {"$match": match_query},
                            {
                                "$set": {
                                    "last_status": {"$last": "$status"},
                                }
                            },
                            {
                                "$set": {
                                    "state": "$last_status.state",
                                }
                            },
                            {"$match": match_state},
                            {"$count": "found_count"},
                        ],
                        "data": [
                            {
                                "$match": match_query,
                            },
                            {
                                "$set": {
                                    "last_status": {"$last": "$status"},
                                    "first_status": {"$first": "$status"},
                                }
                            },
                            {
                                "$set": {
                                    "created_at": "$first_status.timestamp",
                                    "progress": "$last_status.progress",
                                    "state": "$last_status.state",
                                    "stage": "$last_status.stage",
                                }
                            },
                            {"$match": match_state},
                            {"$sort": sort},
                            {"$skip": skip_count},
                            {"$limit": per_page},
                        ],
                    }
                },
                {
                    "$project": {
                        "data": {
                            "_id": True,
                            "created_at": True,
                            "archived": True,
                            "progress": True,
                            "stage": True,
                            "state": True,
                            "user": True,
                            "workflow": True,
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
            page_count = int(math.ceil(found_count / per_page))

        documents = await apply_transforms(data, [AttachUserTransform(self._db)])

        for document in documents:
            document["user"] = UserNested(**document["user"])

        return JobSearchResult(
            counts=await self._get_counts(),
            documents=[JobMinimal(**document) for document in documents],
            total_count=total_count,
            found_count=found_count,
            page_count=page_count,
            per_page=per_page,
            page=page,
        )

    async def create(
        self,
        workflow: str,
        job_args: Document,
        user_id: str,
        rights: JobRights,
        job_id: Optional[str] = None,
    ) -> Job:
        """
        Create a job record and queue it.

        Create job record in MongoDB and get an ID. Queue the ID using the JobsClient so
        that it is picked up by a workflow runner.

        :param workflow: the name of the workflow to run
        :param job_args: the arguments required to run the job
        :param user_id: the user that started the job
        :param rights: the rights the job will have on Virtool resources
        :param job_id: an optional ID to use for the new job

        """
        document = {
            "acquired": False,
            "archived": False,
            "workflow": workflow,
            "args": job_args,
            "key": None,
            "rights": rights.as_dict(),
            "state": "waiting",
            "status": [compose_status("waiting", None)],
            "user": {"id": user_id},
            "ping": None
        }

        if job_id:
            document["_id"] = job_id

        document = await self._db.jobs.insert_one(document)
        await self._client.enqueue(workflow, document["_id"])

        return await fetch_complete_job(self._db, document)

    async def get(self, job_id: str) -> Job:
        """
        Get a job document.

        :param job_id: the ID of the job document to get.
        :return: the job document
        """
        document = await self._db.jobs.find_one(job_id, projection=PROJECTION)

        if document is None:
            raise ResourceNotFoundError

        return await fetch_complete_job(self._db, document)

    async def acquire(self, job_id: str):
        """
        Set the `started` field on a job to `True` and return the complete document.

        :param job_id: the ID of the job to start
        :return: the complete job document

        """
        acquired = await get_one_field(self._db.jobs, "acquired", job_id)

        if acquired is None:
            raise ResourceNotFoundError("Job not found")

        if acquired is True:
            raise ResourceConflictError("Job already acquired")

        key, hashed = virtool.utils.generate_key()

        document = await self._db.jobs.find_one_and_update(
            {"_id": job_id},
            {
                "$set": {"acquired": True, "key": hashed},
                "$push": {"status": compose_status("preparing", None, progress=3)},
            },
            projection=PROJECTION,
        )

        return await fetch_complete_job(self._db, document, key=key)

    async def archive(self, job_id: str) -> Job:
        """
        Set the `archived` field on a job to `True` and return the complete document.

        :param job_id: the ID of the job to start
        :return: the complete job document

        """

        archived = await get_one_field(self._db.jobs, "archived", job_id)

        if archived is None:
            raise ResourceNotFoundError("Job not found")

        if archived is True:
            raise ResourceConflictError("Job already archived")

        document = await self._db.jobs.find_one_and_update(
            {"_id": job_id},
            {"$set": {"archived": True}},
            projection=PROJECTION,
        )

        return await fetch_complete_job(self._db, document)

    async def ping(self, job_id: str) -> JobPing:
        """
        Update the `ping` field on a job to the current time and
        return .

        :param job_id: the ID of the job to start
        :return: the complete job document
        """

        ping = {"pinged_at": virtool.utils.timestamp()}

        document = await self._db.jobs.find_one_and_update(
            {"_id": job_id},
            {"$set": {"ping": ping}},
            projection=PROJECTION,
        )

        if document is None:
            raise ResourceNotFoundError("Job not found")

        return JobPing(**ping)

    async def cancel(self, job_id: str) -> Job:
        """
        Add a cancellation status sub-document to the job identified by `job_id`.

        :param job_id: the ID of the job to add a cancellation status for
        :return: the updated job document

        """
        document = await self._db.jobs.find_one({"_id": job_id}, projection=PROJECTION)

        if document is None:
            raise ResourceNotFoundError

        if not is_running_or_waiting(document):
            raise ResourceConflictError("Not cancellable")

        result = await self._client.cancel(job_id)

        if result == JOB_REMOVED_FROM_QUEUE:
            latest = document["status"][-1]

            document = await self._db.jobs.find_one_and_update(
                {"_id": job_id},
                {
                    "$push": {
                        "status": compose_status(
                            "cancelled", latest["stage"], progress=latest["progress"]
                        )
                    }
                },
                projection=PROJECTION,
            )

            if document is None:
                raise ResourceNotFoundError

        return await fetch_complete_job(self._db, document)

    async def push_status(
        self,
        job_id: str,
        state: Optional[str],
        stage: Optional[str],
        step_name: Optional[str] = None,
        step_description: Optional[str] = None,
        error: Optional[dict] = None,
        progress: Optional[int] = None,
    ):
        status = await get_one_field(self._db.jobs, "status", job_id)

        if status is None:
            raise ResourceNotFoundError

        if status[-1]["state"] in ("complete", "cancelled", "error", "terminated"):
            raise ResourceConflictError("Job is finished")

        document = await self._db.jobs.find_one_and_update(
            {"_id": job_id},
            {
                "$set": {"state": state},
                "$push": {
                    "status": compose_status(
                        state, stage, step_name, step_description, error, progress
                    )
                },
            },
        )

        return JobStatus(**document["status"][-1])

    async def clear(self, complete: bool = False, failed: bool = False):
        or_list = []

        if complete:
            or_list = OR_COMPLETE

        if failed:
            or_list += OR_FAILED

        if len(or_list) == 0:
            return []

        query = {"$or": or_list}

        removed = await self._db.jobs.distinct("_id", query)

        await self._db.jobs.delete_many(query)

        return removed

    async def delete(self, job_id: str):
        """
        Delete a job by its ID.

        :param job_id: the ID of the job to delete
        """
        document = await self._db.jobs.find_one({"_id": job_id}, ["status"])

        if document is None:
            raise ResourceNotFoundError

        if is_running_or_waiting(document):
            raise ResourceConflictError(
                "Job is running or waiting and cannot be removed."
            )

        delete_result = await self._db.jobs.delete_one({"_id": job_id})

        if delete_result.deleted_count == 0:
            raise ResourceNotFoundError

    async def force_delete(self):
        """
        Force the deletion of all jobs.

        """
        job_ids = await self._db.jobs.distinct("_id")
        await gather(*[self._client.cancel(job_id) for job_id in job_ids])
        await self._db.jobs.delete_many({"_id": {"$in": job_ids}})
