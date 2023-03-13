import math
from asyncio import gather
from collections import defaultdict
from typing import List
from typing import Optional, Dict

import arrow
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.job import (
    JobMinimal,
    JobSearchResult,
    JobStatus,
    Job,
    JobPing,
    JobState,
)
from virtool_core.models.user import UserNested

import virtool.utils
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.jobs import is_running_or_waiting
from virtool.jobs.client import AbstractJobsClient, JOB_REMOVED_FROM_QUEUE
from virtool.jobs.db import PROJECTION, fetch_complete_job
from virtool.jobs.utils import JobRights, compose_status
from virtool.mongo.core import DB
from virtool.mongo.transforms import apply_transforms
from virtool.mongo.utils import get_one_field
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

    async def find(
        self,
        archived: bool,
        page: int,
        per_page: int,
        states: List[JobState],
        users: List[str],
    ) -> JobSearchResult:
        skip_count = 0

        if page > 1:
            skip_count = (page - 1) * per_page

        sort = {"created_at": -1}

        match_query = {
            **({"archived": archived} if archived is not None else {}),
            **({"user.id": {"$in": users}} if users else {}),
        }

        match_state = (
            {"state": {"$in": [state.value for state in states]}} if states else {}
        )

        data = {}
        found_count = 0
        total_count = 0
        page_count = 0

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
        space_id: int,
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
            "space": {"id": space_id},
            "state": JobState.WAITING.value,
            "status": [compose_status(JobState.WAITING, None)],
            "user": {"id": user_id},
            "ping": None,
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
                "$push": {
                    "status": compose_status(JobState.PREPARING, None, progress=3)
                },
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

    async def bulk_archive(self, job_ids: List[str]) -> List[JobMinimal]:
        """
        Archive multiple jobs at the same time.

        :param job_ids: the ids of the jobs to archive
        :return: the archived jobs
        """

        existing_jobs = await self._db.jobs.distinct("_id")

        jobs_not_found = [job for job in job_ids if job not in existing_jobs]

        if len(jobs_not_found) != 0:
            raise ResourceNotFoundError(f"Jobs not found: {jobs_not_found}")

        async with self._db.create_session() as session:
            await self._db.jobs.update_many(
                {"_id": {"$in": job_ids}},
                {"$set": {"archived": True}},
                session=session,
            )

        pipeline = [
            {"$match": {"_id": {"$in": job_ids}}},
            {
                "$group": {
                    "_id": "$_id",
                    "created_at": {"$first": "$created_at"},
                    "archived": {"$first": "$archived"},
                    "progress": {"$first": "$progress"},
                    "stage": {"$first": "$stage"},
                    "state": {"$first": "$state"},
                    "user": {"$first": "$user"},
                    "workflow": {"$first": "$workflow"},
                }
            },
        ]

        archived_jobs = []

        async for agg in self._db.jobs.aggregate(pipeline):
            user = await self._db.users.find_one(agg["user"]["id"])
            archived_jobs.append(
                {
                    "id": agg["_id"],
                    "created_at": agg["created_at"],
                    "archived": agg["archived"],
                    "progress": agg["progress"],
                    "stage": agg["stage"],
                    "state": agg["state"],
                    "user": {
                        "id": user["_id"],
                        "handle": user["handle"],
                        "administrator": user["administrator"],
                    },
                    "workflow": agg["workflow"],
                }
            )

        return [JobMinimal(**document) for document in archived_jobs]

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
                            JobState.CANCELLED,
                            latest["stage"],
                            progress=latest["progress"],
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
        state: Optional[JobState],
        stage: Optional[str],
        step_name: Optional[str] = None,
        step_description: Optional[str] = None,
        error: Optional[dict] = None,
        progress: Optional[int] = None,
    ):
        status = await get_one_field(self._db.jobs, "status", job_id)

        if status is None:
            raise ResourceNotFoundError

        if JobState(status[-1]["state"]) in (
            JobState.COMPLETE,
            JobState.CANCELLED,
            JobState.ERROR,
            JobState.TERMINATED,
            JobState.TIMEOUT,
        ):
            raise ResourceConflictError("Job is finished")

        document = await self._db.jobs.find_one_and_update(
            {"_id": job_id},
            {
                "$set": {"state": state.value},
                "$push": {
                    "status": compose_status(
                        state, stage, step_name, step_description, error, progress
                    )
                },
            },
        )

        return JobStatus(**document["status"][-1])

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

    async def timeout(self):
        """
        Timeout dead jobs.

        Times out all jobs that have been running or preparing for more than 30 days.
        This conservatively cleans up legacy jobs that do not have a ping field.

        Times out all jobs that have a ping field and haven't received a ping in 5
        minutes.

        """
        now = arrow.utcnow()

        async with self._db.create_session() as session:
            async for document in self._db.jobs.find(
                {
                    "state": {
                        "$in": [JobState.PREPARING.value, JobState.RUNNING.value]
                    },
                    "$or": [
                        {"ping.pinged_at": {"$lt": now.shift(minutes=-5).naive}},
                        {
                            "ping": None,
                            "status.0.timestamp": {"$lt": now.shift(days=-30).naive},
                        },
                    ],
                },
                session=session,
            ):
                latest = document["status"][-1]

                await self._db.jobs.update_one(
                    {"_id": document["_id"]},
                    {
                        "$set": {"state": JobState.TIMEOUT.value},
                        "$push": {
                            "status": compose_status(
                                JobState.TIMEOUT,
                                latest["stage"],
                                latest["step_name"],
                                latest["step_description"],
                                None,
                                latest["progress"],
                            )
                        },
                    },
                    session=session,
                )
