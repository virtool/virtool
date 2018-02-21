import os
import shutil

import virtool.sample
import virtool.subtraction
import virtool.utils
from virtool.handlers.utils import conflict, compose_regex_query, json_response, no_content, not_found, paginate, \
    protected, unpack_request, validation


async def find(req):
    db = req.app["db"]

    ids = req.query.get("ids", False)

    if ids:
        return json_response(await db.subtraction.distinct("_id"))

    host_count = await db.subtraction.count({"is_host": True})

    ready_host_count = await db.subtraction.count({"is_host": True, "ready": True})

    term = req.query.get("find", None)

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["_id"]))

    data = await paginate(db.subtraction, db_query, req.query, sort="_id", projection=virtool.subtraction.PROJECTION)

    data.update({
        "host_count": host_count,
        "ready_host_count": ready_host_count
    })

    return json_response(data)


async def get(req):
    """
    Get a complete host document.

    """
    db = req.app["db"]

    subtraction_id = req.match_info["subtraction_id"]

    document = await db.subtraction.find_one(subtraction_id)

    if document:
        linked_samples = await db.samples.find({"subtraction.id": subtraction_id}, ["name"]).to_list(None)
        document["linked_samples"] = [virtool.utils.base_processor(d) for d in linked_samples]

        return json_response(virtool.utils.base_processor(document))

    return not_found()


@protected("modify_subtraction")
@validation({
    "subtraction_id": {"type": "string", "required": True},
    "nickname": {"type": "string", "default": ""},
    "file_id": {"type": "string", "required": True}
})
async def create(req):
    """
    Adds a new host described by the transaction. Starts an :class:`.CreateSubtraction` job process.

    """
    db, data = req.app["db"], req["data"]

    subtraction_id = data["subtraction_id"]

    if await db.subtraction.count({"_id": subtraction_id}):
        return conflict("Subtraction name already exists.")

    file_id = data["file_id"]

    file = await db.files.find_one(file_id, ["name"])

    if file is None:
        return not_found("File not found")

    job_id = await virtool.utils.get_new_id(db.jobs)

    user_id = req["client"].user_id

    document = {
        "_id": data["subtraction_id"],
        "ready": False,
        "is_host": True,
        "file": {
            "id": file_id,
            "name": file["name"]
        },
        "user": {
            "id": user_id
        },
        "job": {
            "id": job_id
        }
    }

    await db.subtraction.insert_one(document)

    task_args = {
        "subtraction_id": subtraction_id,
        "file_id": file_id
    }

    await req.app["job_manager"].new(
        "create_subtraction",
        task_args,
        user_id,
        job_id=job_id
    )

    return json_response(virtool.utils.base_processor(document))


async def authorize_upload(req):
    db, data = await unpack_request(req)

    file_id = await db.files.register(
        name=data["name"],
        size=data["size"],
        file_type="host",
        expires=None
    )

    return json_response({"file_id": file_id})


@protected("modify_subtraction")
async def remove(req):
    db = req.app["db"]

    subtraction_id = req.match_info["subtraction_id"]

    reference_path = os.path.join(
        req.app["settings"].get("data_path"),
        "reference",
        "subtraction",
        subtraction_id.replace(" ", "_").lower()
    )

    delete_result = await db.subtraction.delete_one({"_id": subtraction_id})

    if delete_result.deleted_count == 0:
        return not_found()

    await req.loop.run_in_executor(None, shutil.rmtree, reference_path, True)

    return no_content()
