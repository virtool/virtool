import virtool.utils


PROJECTION = [
    "_id",
    "file",
    "ready",
    "job"
]


async def get_linked_samples(db, subtraction_id):
    linked_samples = await db.samples.find({"subtraction.id": subtraction_id}, ["name"]).to_list(None)
    return [virtool.utils.base_processor(d) for d in linked_samples]
