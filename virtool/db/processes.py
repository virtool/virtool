import virtool.db.utils
import virtool.processes
import virtool.utils


async def register(db, process_type, file_size=None):
    process_id = await virtool.db.utils.get_new_id(db.processes)

    document = {
        "_id": process_id,
        "count": 0,
        "created_at": virtool.utils.timestamp(),
        "file_size": file_size,
        "progress": 0,
        "step": virtool.processes.FIRST_STEPS[process_type],
        "type": process_type
    }

    await db.processes.insert_one(document)

    return virtool.utils.base_processor(document)


async def update(db, process_id, count=None, progress=None, step=None, file_progress=None, file_size=None, errors=None):
    update_dict = dict()

    if count is not None:
        update_dict["count"] = count

    if progress is not None:
        update_dict["progress"] = progress

    if step:
        update_dict["step"] = step

    if file_progress:
        update_dict["file_progress"] = file_progress

    if file_size:
        update_dict["file_size"] = file_size

    if errors is not None:
        update_dict["errors"] = errors

    document = await db.processes.find_one_and_update({"_id": process_id}, {
        "$set": update_dict
    })

    return virtool.utils.base_processor(document)


async def remove(db, process_id):
    await db.processes.delete_one({"_id": process_id})
