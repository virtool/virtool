import virtool.db.utils
import virtool.utils

PROJECTION = [
    "_id",
    "count",
    "file",
    "ready",
    "job",
    "name",
    "nickname",
    "user"
]


async def get_linked_samples(db, subtraction_id):
    cursor = db.samples.find({"subtraction.id": subtraction_id}, ["name"])
    return [virtool.utils.base_processor(d) async for d in cursor]


async def attach_subtraction(db, document: dict):
    if "subtraction" in document:
        document["subtraction"]["name"] = await virtool.db.utils.get_one_field(
            db.subtraction,
            "name",
            document["subtraction"]["id"]
        )
