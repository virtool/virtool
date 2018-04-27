import pymongo

import virtool.db.utils
import virtool.processes
import virtool.utils


async def register(db, dispatch, process_type, file_size=0):

    step_count = virtool.processes.STEP_COUNTS[process_type]

    if process_type in virtool.processes.UNIQUES:
        await db.processes.delete_many({"type": process_type})
        process_id = process_type

    else:
        process_id = await virtool.db.utils.get_new_id(db.processes)

    document = {
        "_id": process_id,
        "type": process_type,
        "progress": 0,
        "step": virtool.processes.FIRST_STEPS[process_type],
        "step_count": step_count
    }

    await db.processes.insert_one(document)

    document = virtool.utils.base_processor(document)

    await dispatch("processes", "update", document)

    return document


async def update(db, dispatch, process_id, progress=None, step=None, file_step=None, file_progress=None, file_size=None,
                 errors=None):

    update_dict = dict()

    if progress is not None:
        update_dict["progress"] = progress

    if step:
        update_dict["step"] = step

    if file_step is not None:
        update_dict["file_step"] = file_step

    if file_progress:
        update_dict["file_progress"] = file_progress

    if file_size:
        update_dict["file_size"] = file_size

    if errors is not None:
        update_dict["errors"] = errors

    document = await db.processes.find_one_and_update({"_id": process_id}, {
        "$set": update_dict
    }, return_document=pymongo.ReturnDocument.AFTER)

    document = virtool.utils.base_processor(document)

    await dispatch("processes", "update", document)

    return document


async def remove(db, dispatch, process_id):
    await db.processes.delete_one({"_id": process_id})

    await dispatch("processes", "remove", [process_id])
