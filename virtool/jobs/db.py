"""
Constants and utility functions for interacting with the jobs collection in the
application database.

"""
from virtool_core.models.job import Job, JobAcquired

from virtool.mongo.transforms import apply_transforms
from virtool.users.db import AttachUserTransform
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


def lookup_minimal_jobs_by_id(
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
                    {"$project": {
                        "id": "$_id",
                        "_id": False,
                        "archived": True,
                        "created_at": True,
                        "progress": True,
                        "stage": True,
                        "state": True,
                        "user": True,
                        "workflow": True,
                    }},
                ],
                "as": set_as,
            }
        },
        {"$set": {set_as: {"$first": f"${set_as}"}}},
    ]

