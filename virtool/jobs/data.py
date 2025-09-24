import math
from asyncio import gather
from collections import defaultdict
from typing import TYPE_CHECKING

import arrow
from structlog import get_logger

from virtool.users.models_base import UserNested

if TYPE_CHECKING:
    from pymongo.results import UpdateResult

from sqlalchemy.ext.asyncio import AsyncEngine

import virtool.utils
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emit, emits
from virtool.data.transforms import apply_transforms
from virtool.jobs.client import JobCancellationResult, JobsClient
from virtool.jobs.models import (
    Job,
    JobAcquired,
    JobMinimal,
    JobPing,
    JobSearchResult,
    JobState,
    QueuedJobID,
)
from virtool.jobs.utils import check_job_is_running_or_waiting, compose_status
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.types import Document
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor

logger = get_logger("jobs")

JOB_CLEAN_DOUBLE_CHECK_DELAY = 15
"""Delay before checking for queued jobs again during the clean task."""


class JobsData:
    name = "jobs"

    def __init__(self, client: JobsClient, mongo: Mongo, pg: AsyncEngine):
        self._client = client
        self._mongo = mongo
        self._pg = pg

    async def _get_counts(self) -> dict[str, dict[str, int]]:
        counts = defaultdict(dict)

        async for a in self._mongo.jobs.aggregate(
            [
                {"$addFields": {"last_status": {"$last": "$status"}}},
                {
                    "$group": {
                        "_id": {"workflow": "$workflow", "state": "$last_status.state"},
                        "count": {"$sum": 1},
                    },
                },
            ],
        ):
            workflow = a["_id"]["workflow"]
            state = a["_id"]["state"]
            counts[state][workflow] = a["count"]

        return dict(counts)

    async def find(
        self,
        page: int,
        per_page: int,
        states: list[JobState],
        users: list[str],
    ) -> JobSearchResult:
        skip_count = 0

        if page > 1:
            skip_count = (page - 1) * per_page

        match_query = {"user.id": {"$in": users}} if users else {}

        match_state = (
            {"state": {"$in": [state.value for state in states]}} if states else {}
        )

        data = {}
        found_count = 0
        total_count = 0
        page_count = 0

        async for paginate_dict in self._mongo.jobs.aggregate(
            [
                {
                    "$facet": {
                        "total_count": [{"$count": "total_count"}],
                        "found_count": [
                            {"$match": match_query},
                            {"$set": {"last_status": {"$last": "$status"}}},
                            {"$set": {"state": "$last_status.state"}},
                            {"$match": match_state},
                            {"$count": "found_count"},
                        ],
                        "data": [
                            {"$match": match_query},
                            {
                                "$set": {
                                    "last_status": {"$last": "$status"},
                                    "first_status": {"$first": "$status"},
                                },
                            },
                            {
                                "$set": {
                                    "created_at": "$first_status.timestamp",
                                    "progress": "$last_status.progress",
                                    "state": "$last_status.state",
                                    "stage": "$last_status.stage",
                                },
                            },
                            {"$match": match_state},
                            {"$sort": {"created_at": -1}},
                            {"$skip": skip_count},
                            {"$limit": per_page},
                        ],
                    },
                },
                {
                    "$project": {
                        "data": {
                            "_id": True,
                            "created_at": True,
                            "progress": True,
                            "stage": True,
                            "state": True,
                            "user": True,
                            "workflow": True,
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
            page_count = int(math.ceil(found_count / per_page))

        documents = await apply_transforms(
            [base_processor(d) for d in data],
            [AttachUserTransform(self._pg)],
        )

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

    async def list_queued_ids(self) -> list[QueuedJobID]:
        """List all job IDs in Redis.

        :return: a list of job IDs
        """
        return await self._client.list()

    @emits(Operation.CREATE)
    async def create(
        self,
        workflow: str,
        job_args: Document,
        user_id: str,
        space_id: int = 1,
        job_id: str | None = None,
    ) -> Job:
        """Create a job record and queue it.

        Create job record in MongoDB and get an ID. Queue the ID using the JobsClient so
        that it is picked up by a workflow runner.

        :param workflow: the name of the workflow to run
        :param job_args: the arguments required to run the job
        :param user_id: the user that started the job
        :param space_id: the space that the job belongs to
        :param job_id: an optional ID to use for the new job

        """
        document = {
            "acquired": False,
            "args": job_args,
            "key": None,
            "ping": None,
            "rights": {},
            "space": {"id": space_id},
            "state": JobState.WAITING.value,
            "status": [compose_status(JobState.WAITING, None)],
            "user": {"id": user_id},
            "workflow": workflow,
        }

        document["created_at"] = document["status"][0]["timestamp"]

        if job_id:
            document["_id"] = job_id

        document = await self._mongo.jobs.insert_one(document)

        await self._client.enqueue(workflow, document["_id"])

        return await self.get(document["_id"])

    async def get(self, job_id: str) -> Job:
        """Get a job document.

        :param job_id: the ID of the job document to get.
        :return: the job document
        """
        document = await self._mongo.jobs.find_one(job_id)

        if document is None:
            raise ResourceNotFoundError()

        status = document["status"]

        last_update = status[-1]

        document = await apply_transforms(
            {
                **document,
                "id": document["_id"],
                "state": last_update["state"],
                "stage": last_update["stage"],
                "progress": status[-1]["progress"],
            },
            [AttachUserTransform(self._pg)],
        )

        return Job(**document)

    @emits(Operation.UPDATE)
    async def acquire(self, job_id: str) -> JobAcquired:
        """Set the `started` field on a job to `True` and return the complete document.

        :param job_id: the ID of the job to start
        :return: the complete job document

        """
        acquired = await get_one_field(self._mongo.jobs, "acquired", job_id)

        if acquired is None:
            raise ResourceNotFoundError("Job not found")

        if acquired is True:
            raise ResourceConflictError("Job already acquired")

        key, hashed = virtool.utils.generate_key()

        await self._mongo.jobs.update_one(
            {"_id": job_id},
            {
                "$set": {
                    "acquired": True,
                    "key": hashed,
                    "ping": {
                        "pinged_at": virtool.utils.timestamp(),
                    },
                    "state": JobState.PREPARING.value,
                },
                "$push": {
                    "status": compose_status(JobState.PREPARING, None, progress=3),
                },
            },
        )

        job = await self.get(job_id)

        return JobAcquired(**job.dict(), key=key)

    async def ping(self, job_id: str) -> JobPing:
        """Update the `ping` field on a job to the current time.

        :param job_id: the ID of the job to start
        :return: the complete job document
        """
        ping = {"pinged_at": virtool.utils.timestamp()}

        document = await self._mongo.jobs.find_one_and_update(
            {"_id": job_id},
            {"$set": {"ping": ping}},
            projection=["ping"],
        )

        if document:
            return JobPing(**ping)

        raise ResourceNotFoundError("Job not found")

    @emits(Operation.UPDATE)
    async def cancel(self, job_id: str) -> Job:
        """Add a cancellation status sub-document to the job identified by `job_id`.

        :param job_id: the ID of the job to add a cancellation status for
        :return: the updated job document

        """
        document = await self._mongo.jobs.find_one({"_id": job_id}, ["status"])

        if document is None:
            raise ResourceNotFoundError

        if not check_job_is_running_or_waiting(document):
            raise ResourceConflictError("Not cancellable")

        result = await self._client.cancel(job_id)

        if result == JobCancellationResult.REMOVED_FROM_QUEUE:
            latest = document["status"][-1]

            update_result: UpdateResult = await self._mongo.jobs.update_one(
                {"_id": job_id},
                {
                    "$push": {
                        "status": compose_status(
                            JobState.CANCELLED,
                            latest["stage"],
                            progress=latest["progress"],
                        ),
                    },
                    "$set": {
                        "state": JobState.CANCELLED.value,
                    },
                },
            )

            if update_result.modified_count == 0:
                raise ResourceNotFoundError

        return await self.get(job_id)

    async def push_status(
        self,
        job_id: str,
        state: JobState | None,
        stage: str | None,
        step_name: str | None = None,
        step_description: str | None = None,
        error: dict | None = None,
        progress: int | None = None,
    ):
        status = await get_one_field(self._mongo.jobs, "status", job_id)

        if status is None:
            raise ResourceNotFoundError

        if JobState(status[-1]["state"]) in (
            JobState.CANCELLED,
            JobState.COMPLETE,
            JobState.ERROR,
            JobState.TERMINATED,
            JobState.TIMEOUT,
        ):
            raise ResourceConflictError("Job is finished")

        status_update = compose_status(
            state,
            stage,
            step_name,
            step_description,
            error,
            progress,
        )

        await self._mongo.jobs.update_one(
            {"_id": job_id},
            {"$set": {"state": state.value}, "$push": {"status": status_update}},
        )

        job = await self.get(job_id)

        emit(job, self.name, "push_status", Operation.UPDATE)

        return job.status[-1]

    async def delete(self, job_id: str) -> None:
        """Delete a job by its ID.

        :param job_id: the ID of the job to delete
        """
        job = await self.get(job_id)

        if job is None:
            raise ResourceNotFoundError

        if check_job_is_running_or_waiting(job.dict()):
            raise ResourceConflictError(
                "Job is running or waiting and cannot be removed.",
            )

        delete_result = await self._mongo.jobs.delete_one({"_id": job_id})

        if delete_result.deleted_count == 0:
            raise ResourceNotFoundError

        emit(job, "jobs", "delete", Operation.DELETE)

    async def force_delete(self) -> None:
        """Force the deletion of all jobs."""
        job_ids = await self._mongo.jobs.distinct("_id")
        await gather(*[self._client.cancel(job_id) for job_id in job_ids])
        await self._mongo.jobs.delete_many({"_id": {"$in": job_ids}})

    async def timeout_stalled_jobs(self) -> int:
        """Timeout stalled jobs.

        This task considers jobs in the PREPARING and RUNNING states that
        have not been pinged in the last 5 minutes.

        Jobs that are stalled will be timed out immediately.

        :return: the number of jobs that were timed out
        """
        now = arrow.utcnow()

        query = {
            "state": {"$in": [JobState.PREPARING.value, JobState.RUNNING.value]},
            "ping.pinged_at": {"$lt": now.shift(minutes=-5).naive},
        }

        timeout_count = 0

        # Find all stalled jobs and timeout each one
        async for document in self._mongo.jobs.find(query, ["_id", "status"]):
            try:
                latest_status = document["status"][-1]

                result = await self._mongo.jobs.update_one(
                    {
                        "_id": document["_id"],
                        "state": {
                            "$in": [JobState.PREPARING.value, JobState.RUNNING.value]
                        },
                        "ping.pinged_at": {"$lt": now.shift(minutes=-5).naive},
                    },
                    {
                        "$push": {
                            "status": compose_status(
                                JobState.TIMEOUT,
                                latest_status.get("stage"),
                                latest_status.get("step_name"),
                                latest_status.get("step_description"),
                                None,
                                latest_status.get("progress"),
                            ),
                        },
                        "$set": {"state": JobState.TIMEOUT.value},
                    },
                )

                if result.modified_count > 0:
                    timeout_count += 1
                    emit(
                        await self.get(document["_id"]),
                        self.name,
                        "timeout",
                        Operation.UPDATE,
                    )

            except Exception as e:
                logger.warning(
                    "failed to timeout job", error=str(e), job_id=document["_id"]
                )

        if timeout_count > 0:
            logger.info("timed out stalled jobs", count=timeout_count)

        return timeout_count
