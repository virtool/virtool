"""
Constants and utility functions for interacting with the jobs collection in the
application database.

"""
from typing import Optional

from virtool_core.models.job import Job, JobAcquired, JobState
from virtool.jobs.client import AbstractJobsClient

from virtool.jobs.utils import compose_status, JobRights
from virtool.mongo.core import Mongo
from virtool.mongo.transforms import apply_transforms
from virtool.types import Document
from virtool.users.db import AttachUserTransform, lookup_nested_user_by_id
from virtool.utils import base_processor

OR_COMPLETE = [{"status.state": "complete"}]

OR_FAILED = [{"status.state": "error"}, {"status.state": "cancelled"}]

#: A projection for minimal representations of jobs suitable for search results.
LIST_PROJECTION = [
    "_id",
    "archived",
    "workflow",
    "status",
    "rights",
    "user",
]

#: A projection for full job details. Excludes the secure key field.
PROJECTION = {"key": False}


async def processor(db, document: dict) -> dict:
    """
    The default document processor for job documents.

    Transforms projected job documents to a structure that can be dispatches to clients.

    1. Removes the ``status`` and ``args`` fields from the job document.
    2. Adds a ``username`` field.
    3. Adds a ``created_at`` date taken from the first status entry in the job document.
    4. Adds ``state`` and ``progress`` fields derived from the most recent ``status``
       entry in the job document.

    :param db: the application database object
    :param document: a document to process
    :return: a processed document

    """
    status = document["status"]

    last_update = status[-1]

    return await apply_transforms(
        base_processor(
            {
                **document,
                "state": last_update["state"],
                "stage": last_update["stage"],
                "created_at": status[0]["timestamp"],
                "progress": status[-1]["progress"],
            }
        ),
        [AttachUserTransform(db)],
    )


async def fetch_complete_job(db, document, key=None) -> Job:
    document = await processor(db, document)

    if key:
        return JobAcquired(**document, key=key)

    return Job(**document)


def lookup_minimal_job_by_id(
        local_field: str = "job.id", set_as: str = "job"
) -> list[dict]:
    """
    Create a mongoDB aggregation pipeline step to look up a job by id.

    :param local_field: job id field to look up
    :param set_as: desired name of the returned record
    :return: mongoDB aggregation steps for use in an aggregation pipeline
    """

    return [
        {
            "$lookup": {
                "from": "jobs",
                "let": {"job_id": f"${local_field}"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", "$$job_id"]}}},
                    {
                        "$set": {
                            "first_status": {"$first": "$status"},
                            "last_status": {"$last": "$status"},
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
                    *lookup_nested_user_by_id(local_field="user.id"),
                    {
                        "$project": {
                            "id": "$_id",
                            "_id": False,
                            "archived": True,
                            "user": True,
                            "workflow": True,
                            "created_at": True,
                            "progress": True,
                            "stage": True,
                            "state": True,
                        }
                    },
                ],
                "as": set_as,
            }
        },
        {"$set": {set_as: {"$ifNull": [{"$first": f"${set_as}"}, None]}}},
    ]


async def create_job(
        mongo: Mongo,
        client: AbstractJobsClient,
        workflow: str,
        job_args: Document,
        user_id: str,
        rights: JobRights,
        space_id: int,
        job_id: Optional[str] = None,
        session=None
) -> Job:
    """
    Create a job record and queue it.

    Create job record in MongoDB and get an ID. Queue the ID using the JobsClient so
    that it is picked up by a workflow runner.

    :param jobsData: job data layer
    :param workflow: the name of the workflow to run
    :param job_args: the arguments required to run the job
    :param user_id: the user that started the job
    :param rights: the rights the job will have on Virtool resources
    :param job_id: an optional ID to use for the new job
    :param session: MongoDB session to use

    """

    # call db function to do the real work
    #  assume db function named create_job(**params, session=None)
    # createjob(**params, session=None)
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

    document = await mongo.jobs.insert_one(document, session=session)
    await client.enqueue(workflow, document["_id"])

    return await fetch_complete_job(mongo, document)
