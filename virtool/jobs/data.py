from asyncio import gather
from collections import defaultdict
from typing import Mapping, Optional, Dict

from sqlalchemy.ext.asyncio import AsyncEngine

import virtool.utils
from virtool.api.utils import compose_regex_query, paginate
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.db.core import DB
from virtool.db.transforms import apply_transforms
from virtool.db.utils import get_one_field
from virtool.jobs import is_running_or_waiting
from virtool.jobs.client import AbstractJobsClient, JOB_REMOVED_FROM_QUEUE
from virtool.jobs.db import (
    LIST_PROJECTION,
    OR_COMPLETE,
    OR_FAILED,
    PROJECTION,
    processor,
)
from virtool.jobs.utils import JobRights, compose_status
from virtool.types import Document
from virtool.users.db import AttachUserTransform
from virtool.utils import base_processor


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

    async def _find_basic(self, query: Mapping) -> Document:
        term = query.get("find")

        db_query = {}

        if term:
            db_query.update(compose_regex_query(term, ["workflow", "user.id"]))

        data = await paginate(
            self._db.jobs,
            db_query,
            query,
            projection=LIST_PROJECTION,
            sort="created_at",
        )

        return {
            **data,
            "counts": await self._get_counts(),
            "documents": await apply_transforms(
                data["documents"], [AttachUserTransform(self._db)]
            ),
        }

    async def _find_beta(self, query: Mapping) -> Document:
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
        state = query.get("state")
        term = query.get("find")

        documents = [
            base_processor(d)
            async for d in self._db.jobs.aggregate(
                [
                    {"$match": compose_regex_query(term, ["user.id"]) if term else {}},
                    {"$set": {"last_status": {"$last": "$status"}}},
                    {
                        "$set": {
                            "progress": "$last_status.progress",
                            "state": "$last_status.state",
                            "stage": "$last_status.stage",
                        }
                    },
                    {"$match": {"state": state} if state else {}},
                    {
                        "$project": {
                            "_id": True,
                            "created_at": True,
                            "progress": True,
                            "stage": True,
                            "state": True,
                            "user": True,
                            "workflow": True,
                        }
                    },
                ],
            )
        ]

        return {
            "counts": await self._get_counts(),
            "documents": await apply_transforms(
                documents, [AttachUserTransform(self._db)]
            ),
        }

    async def find(self, query: Mapping):
        """
        :param query:
        :return:
        """
        if query.get("beta"):
            return await self._find_beta(query)

        return await self._find_basic(query)

    async def create(
        self,
        workflow: str,
        job_args: Document,
        user_id: str,
        rights: JobRights,
        job_id: Optional[str] = None,
    ) -> Document:
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
            "workflow": workflow,
            "args": job_args,
            "key": None,
            "rights": rights.as_dict(),
            "state": "waiting",
            "status": [compose_status("waiting", None)],
            "user": {"id": user_id},
        }

        if job_id:
            document["_id"] = job_id

        await self._db.jobs.insert_one(document)
        await self._client.enqueue(workflow, document["_id"])

        return document

    async def get(self, job_id: str) -> Document:
        """
        Get a job document.

        :param job_id: the ID of the job document to get.
        :return: the job document
        """
        document = await self._db.jobs.find_one(job_id, projection=PROJECTION)

        if document is None:
            raise ResourceNotFoundError

        return await processor(self._db, document)

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

        return await processor(self._db, {**document, "key": key})

    async def cancel(self, job_id: str) -> Document:
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

        return await processor(self._db, document)

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

        return await self._db.jobs.find_one_and_update(
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

    async def clear(self, complete: bool = False, failed: bool = False):
        or_list = []

        if complete:
            or_list = OR_COMPLETE

        if failed:
            or_list += OR_FAILED

        if len(or_list) == 0:
            return []

        query = {"$or": or_list}

        async with self._db.create_session() as session:
            removed = await self._db.jobs.distinct("_id", query, session=session)
            await self._db.jobs.delete_many(query, session=session)

        return removed

    async def delete(self, job_id: str):
        """
        Delete a job by its ID.

        :param job_id: the ID of the job to delete
        """
        async with self._db.create_session() as session:
            document = await self._db.jobs.find_one(
                {"_id": job_id}, ["status"], session=session
            )

            if document is None:
                raise ResourceNotFoundError

            if is_running_or_waiting(document):
                raise ResourceConflictError(
                    "Job is running or waiting and cannot be removed."
                )

            delete_result = await self._db.jobs.delete_one(
                {"_id": job_id}, session=session
            )

            if delete_result.deleted_count == 0:
                raise ResourceNotFoundError

    async def force_delete(self):
        """
        Force the deletion of all jobs.

        """
        async with self._db.create_session() as session:
            job_ids = await self._db.jobs.distinct("_id", session=session)

            await gather(*[self._client.cancel(job_id) for job_id in job_ids])
            await self._db.jobs.delete_many({"_id": {"$in": job_ids}}, session=session)
