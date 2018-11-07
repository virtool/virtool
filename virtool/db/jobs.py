"""
Globals and utility functions for interacting with the jobs collection in the application database.

"""
import virtool.utils

OR_COMPLETE = [
    {"status.state": "complete"}
]

OR_FAILED = [
    {"status.state": "error"},
    {"status.state": "cancelled"}
]

#: The default MongoDB projection for job documents.
PROJECTION = [
    "_id",
    "task",
    "status",
    "proc",
    "mem",
    "user"
]


async def cancel(db, job_id):
    document = await db.jobs.find_one(job_id, ["status"])

    latest = document["status"][-1]

    await db.jobs.update_one({"_id": job_id}, {
        "$push": {
            "status": {
                "state": "cancelled",
                "stage": latest["stage"],
                "error": None,
                "progress": latest["progress"],
                "timestamp": virtool.utils.timestamp()
            }
        }
    })


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


async def create(db, settings, task_name, task_args, user_id, job_id=None):
    proc = settings[task_name + "_proc"]
    mem = settings[task_name + "_mem"]

    document = {
        "task": task_name,
        "args": task_args,
        "proc": proc,
        "mem": mem,
        "user": {
            "id": user_id
        },
        "status": [
            {
                "state": "waiting",
                "stage": None,
                "error": None,
                "progress": 0,
                "timestamp": virtool.utils.timestamp()
            }
        ]
    }

    if job_id:
        document["_id"] = job_id

    return await db.jobs.insert_one(document)


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


def processor(document: dict) -> dict:
    """
    The default document processor for job documents. Transforms projected job documents to a structure that can be
    dispatches to clients.

    1. Removes the ``status`` and ``args`` fields from the job document.
    2. Adds a ``username`` field.
    3. Adds a ``created_at`` date taken from the first status entry in the job document.
    4. Adds ``state`` and ``progress`` fields derived from the most recent ``status`` entry in the job document.

    :param document: a document to process
    :return: a processed document
    """
    document["id"] = document.pop("_id")

    status = document.pop("status")

    last_update = status[-1]

    document.update({
        "state": last_update["state"],
        "stage": last_update["stage"],
        "created_at": status[0]["timestamp"],
        "progress": status[-1]["progress"]
    })

    return document
