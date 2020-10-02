import virtool.tasks.steps
import virtool.db.utils
import virtool.tasks.task
import virtool.utils


async def register(db, task_type, context=None):
    task_id = await virtool.db.utils.get_new_id(db.tasks)

    document = {
        "_id": task_id,
        "complete": False,
        "count": 0,
        "created_at": virtool.utils.timestamp(),
        "progress": 0,
        "resumable": False,
        "context": context or dict(),
        "step": virtool.tasks.steps.FIRST_STEPS[task_type],
        "type": task_type
    }

    await db.tasks.insert_one(document)

    return virtool.utils.base_processor(document)


async def update(db, task_id, count=None, progress=None, step=None, context_update=None, errors=None):
    update_dict = dict()

    if count is not None:
        update_dict["count"] = count

    if progress is not None:
        update_dict["progress"] = progress

    if step:
        update_dict["step"] = step

    if errors is not None:
        update_dict["errors"] = errors

    if context_update:
        for key, value in context_update.items():
            update_dict[f"context.{key}"] = value

    document = await db.tasks.find_one_and_update({"_id": task_id}, {
        "$set": update_dict
    })

    return virtool.utils.base_processor(document)


async def complete(db, task_id):
    await db.tasks.update_one({"_id": task_id}, {
        "$set": {
            "complete": True,
            "progress": 1
        }
    })


async def remove(db, task_id):
    await db.tasks.delete_one({"_id": task_id})
