import virtool.utils

PROJECTION = [
    "_id",
    "file",
    "ready",
    "job"
]


async def get_linked_samples(db, subtraction_id):
    cursor = db.samples.find({"subtraction.id": subtraction_id}, ["name"])
    return [virtool.utils.base_processor(d) async for d in cursor]
