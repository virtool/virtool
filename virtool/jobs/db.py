"""
Constants and utility functions for interacting with the jobs collection in the application database.

"""
from typing import Any, Dict, Optional

import virtool.jobs.runner
import virtool.utils
from virtool.jobs.utils import JobRights
from virtool.utils import base_processor

OR_COMPLETE = [
    {"status.state": "complete"}
]

OR_FAILED = [
    {"status.state": "error"},
    {"status.state": "cancelled"}
]

#: A projection for minimal representations of jobs suitable for search results.
LIST_PROJECTION = [
    "_id",
    "task",
    "status",
    "proc",
    "mem",
    "rights",
    "user"
]

#: A projection for full job details. Excludes the secure key field.
PROJECTION = {
    "key": False
}


async def cancel(db, job_id: str) -> dict:
    """
    Add a cancellation status sub-document to the job identified by `job_id`.

    :param db: the application database connection
    :param job_id: the ID of the job to add a cancellation status for

    """
    document = await db.jobs.find_one(job_id, ["status"])

    latest = document["status"][-1]

    return await db.jobs.find_one_and_update({"_id": job_id}, {
        "$push": {
            "status": {
                "state": "cancelled",
                "stage": latest["stage"],
                "error": None,
                "progress": latest["progress"],
                "timestamp": virtool.utils.timestamp()
            }
        }
    }, projection=virtool.jobs.db.PROJECTION)


async def clear(db, complete=False, failed=False):
    or_list = list()

    if complete:
        or_list = OR_COMPLETE

    if failed:
        or_list += OR_FAILED

    removed = list()

    if len(or_list):
        query = {
            "$or": or_list
        }

        removed = await db.jobs.distinct("_id", query)
        await db.jobs.delete_many(query)

    return removed


async def create(
        db,
        workflow_name: str,
        job_args: Dict[str, Any],
        user_id: str,
        rights: JobRights,
        job_id: Optional[str] = None
):
    """
    Create, insert, and return a job document.
    
    :param db: the application database object
    :param workflow_name: the name of the workflow to run
    :param job_args: the arguments required to run the job
    :param user_id: the user that started the job
    :param rights: the rights the job will have on Virtool resources
    :param job_id: an optional ID to use for the new job
    
    """
    document = {
        "acquired": False,
        "task": workflow_name,
        "args": job_args,
        "key": None,
        "rights": rights.as_dict(),
        "state": "waiting",
        "status": [
            {
                "state": "waiting",
                "stage": None,
                "error": None,
                "progress": 0,
                "timestamp": virtool.utils.timestamp()
            }
        ],
        "user": {
            "id": user_id
        }
    }

    if job_id:
        document["_id"] = job_id

    document = await db.jobs.insert_one(document)

    return document


async def acquire(db, job_id: str) -> Dict[str, Any]:
    """
    Set the `started` field on a job to `True` and return the complete document.

    :param db: the application database object
    :param job_id: the ID of the job to start
    :return: the complete job document

    """
    key, hashed = virtool.utils.generate_key()

    document = await db.jobs.find_one_and_update({"_id": job_id}, {
        "$set": {
            "acquired": True,
            "key": hashed
        }
    }, projection=PROJECTION)

    document["key"] = key

    return base_processor(document)


async def delete_zombies(db):
    await db.jobs.delete_many({
        "status.state": {
            "$nin": [
                "complete",
                "cancelled",
                "error"
            ]
        }
    })


async def get_waiting_and_running_ids(db):
    cursor = db.jobs.aggregate([
        {"$project": {
            "status": {
                "$arrayElemAt": ["$status", -1]
            }
        }},

        {"$match": {
            "$or": [
                {"status.state": "waiting"},
                {"status.state": "running"},
            ]
        }},

        {"$project": {
            "_id": True
        }}
    ])

    return [a["_id"] async for a in cursor]


async def processor(db, document: dict) -> dict:
    """
    The default document processor for job documents. Transforms projected job documents to a structure that can be
    dispatches to clients.

    1. Removes the ``status`` and ``args`` fields from the job document.
    2. Adds a ``username`` field.
    3. Adds a ``created_at`` date taken from the first status entry in the job document.
    4. Adds ``state`` and ``progress`` fields derived from the most recent ``status`` entry in the job document.

    :param db: the application database object
    :param document: a document to process
    :return: a processed document

    """
    status = document.pop("status")

    last_update = status[-1]

    document.update({
        "state": last_update["state"],
        "stage": last_update["stage"],
        "created_at": status[0]["timestamp"],
        "progress": status[-1]["progress"]
    })

    return virtool.utils.base_processor(document)
