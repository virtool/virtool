import virtool.utils

OR_COMPLETE = [
    {"status.state": "complete"}
]

OR_FAILED = [
    {"status.state": "error"},
    {"status.state": "cancelled"}
]

PROJECTION = [
    "_id",
    "task",
    "status",
    "proc",
    "mem",
    "user"
]


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


async def get_waiting_and_running_ids(db):
    cursor = await db.jobs.aggregate([
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


def processor(document):
    """
    Removes the ``status`` and ``args`` fields from the job document.
    Adds a ``username`` field, an ``added`` date taken from the first status entry in the job document, and
    ``state`` and ``progress`` fields taken from the most recent status entry in the job document.
    :param document: a document to process.
    :type document: dict

    :return: a processed documents.
    :rtype: dict
    """
    document = virtool.utils.base_processor(document)

    status = document.pop("status")

    last_update = status[-1]

    document.update({
        "state": last_update["state"],
        "stage": last_update["stage"],
        "created_at": status[0]["timestamp"],
        "progress": status[-1]["progress"]
    })

    return document
