import shutil

import virtool.jobs.db
import virtool.subtractions.db
import virtool.db.utils
import virtool.http.routes
import virtool.samples.utils
import virtool.subtractions.utils
import virtool.utils
import virtool.validators
from virtool.api import bad_request, compose_regex_query, conflict, json_response, no_content, not_found, paginate

routes = virtool.http.routes.Routes()


@routes.get("/api/subtractions")
async def find(req):
    db = req.app["db"]

    ids = req.query.get("ids", False)

    if ids:
        return json_response(await db.subtraction.distinct("_id", {"ready": True}))

    term = req.query.get("find")

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["_id"]))

    data = await paginate(
        db.subtraction,
        db_query,
        req.query,
        sort="_id",
        projection=virtool.subtractions.db.PROJECTION
    )

    data.update({
        "ready_count": await db.subtraction.count_documents({"ready": True})
    })

    return json_response(data)


@routes.get("/api/subtractions/{subtraction_id}")
async def get(req):
    """
    Get a complete host document.

    """
    db = req.app["db"]

    subtraction_id = req.match_info["subtraction_id"]

    document = await db.subtraction.find_one(subtraction_id)

    if not document:
        return not_found()

    document["linked_samples"] = await virtool.subtractions.db.get_linked_samples(db, subtraction_id)

    return json_response(virtool.utils.base_processor(document))


@routes.post("/api/subtractions", permission="modify_subtraction", schema={
    "subtraction_id": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    },
    "nickname": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": ""
    },
    "file_id": {
        "type": "string",
        "required": True
    }
})
async def create(req):
    """
    Add a new subtraction. Starts an :class:`.CreateSubtraction` job process.

    """
    db = req.app["db"]
    data = req["data"]

    subtraction_id = data["subtraction_id"]

    if await db.subtraction.count_documents({"_id": subtraction_id}):
        return bad_request("Subtraction name already exists")

    file_id = data["file_id"]

    file = await db.files.find_one(file_id, ["name"])

    if file is None:
        return bad_request("File does not exist")

    job_id = await virtool.db.utils.get_new_id(db.jobs)

    user_id = req["client"].user_id

    document = {
        "_id": data["subtraction_id"],
        "nickname": data["nickname"],
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

    await virtool.jobs.db.create(
        db,
        req.app["settings"],
        "create_subtraction",
        task_args,
        user_id,
        job_id=job_id
    )

    await req.app["jobs"].enqueue(job_id)

    headers = {
        "Location": f"/api/account/keys/{subtraction_id}"
    }

    return json_response(virtool.utils.base_processor(document), headers=headers, status=201)


@routes.patch("/api/subtractions/{subtraction_id}", permission="modify_subtraction", schema={
    "nickname": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "required": True
    }
})
async def edit(req):
    """
    Updates the nickname for an existing subtraction.

    """
    db = req.app["db"]
    data = req["data"]

    subtraction_id = req.match_info["subtraction_id"]

    document = await db.subtraction.find_one_and_update({"_id": subtraction_id}, {
        "$set": {
            "nickname": data["nickname"]
        }
    })

    if document is None:
        return not_found()

    document["linked_samples"] = await virtool.subtractions.db.get_linked_samples(db, subtraction_id)

    return json_response(virtool.utils.base_processor(document))


@routes.delete("/api/subtractions/{subtraction_id}", permission="modify_subtraction")
async def remove(req):
    db = req.app["db"]
    settings = req.app["settings"]

    subtraction_id = req.match_info["subtraction_id"]

    if await db.samples.count_documents({"subtraction.id": subtraction_id}):
        return conflict("Has linked samples")

    delete_result = await db.subtraction.delete_one({"_id": subtraction_id})

    if delete_result.deleted_count == 0:
        return not_found()

    index_path = virtool.subtractions.utils.calculate_index_path(settings, subtraction_id)

    await req.app["run_in_thread"](shutil.rmtree, index_path, True)

    return no_content()
