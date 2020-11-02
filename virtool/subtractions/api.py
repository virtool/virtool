import asyncio

import virtool.api.utils
import virtool.db.utils
import virtool.http.routes
import virtool.jobs.db
import virtool.samples.utils
import virtool.subtractions.db
import virtool.subtractions.utils
import virtool.utils
import virtool.validators
from virtool.api.response import bad_request, json_response, no_content, not_found

routes = virtool.http.routes.Routes()

BASE_QUERY = {
    "deleted": False
}


@routes.get("/api/subtractions")
async def find(req):
    db = req.app["db"]

    ready = virtool.api.utils.get_query_bool(req, "ready")
    short = virtool.api.utils.get_query_bool(req, "short")

    projection = ["name"] if short else virtool.subtractions.db.PROJECTION

    db_query = dict()

    term = req.query.get("find")

    if term:
        db_query = virtool.api.utils.compose_regex_query(term, ["name", "nickname"])

    if short:
        documents = list()

        async for document in db.subtraction.find({**db_query, **BASE_QUERY}, ["name"]):
            documents.append(virtool.utils.base_processor(document))

        return json_response(documents)

    if ready:
        db_query["ready"] = True

    data = await virtool.api.utils.paginate(
        db.subtraction,
        db_query,
        req.query,
        base_query=BASE_QUERY,
        sort="_id",
        projection=projection
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
    "name": {
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
    
    file_id = data["file_id"]

    file = await db.files.find_one(file_id, ["name"])

    if file is None:
        return bad_request("File does not exist")

    job_id = await virtool.db.utils.get_new_id(db.jobs)
    subtraction_id = await virtool.db.utils.get_new_id(db.subtraction)

    user_id = req["client"].user_id

    document = {
        "_id": subtraction_id,
        "name": data["name"],
        "nickname": data["nickname"],
        "deleted": False,
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
        },
        "deleted": False
    }

    await db.subtraction.insert_one(document)

    task_args = {
        "subtraction_id": subtraction_id,
        "file_id": file_id
    }

    await virtool.jobs.db.create(
        db,
        "create_subtraction",
        task_args,
        user_id,
        job_id=job_id
    )

    await req.app["jobs"].enqueue(job_id)

    headers = {
        "Location": f"/api/subtraction/{subtraction_id}"
    }

    return json_response(virtool.utils.base_processor(document), headers=headers, status=201)


@routes.patch("/api/subtractions/{subtraction_id}", permission="modify_subtraction", schema={
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
    },
    "nickname": {
        "type": "string",
        "coerce": virtool.validators.strip
    }
})
async def edit(req):
    """
    Updates the nickname for an existing subtraction.

    """
    db = req.app["db"]
    data = req["data"]

    subtraction_id = req.match_info["subtraction_id"]

    update = dict()

    try:
        update["name"] = data["name"]
    except KeyError:
        pass

    try:
        update["nickname"] = data["nickname"]
    except KeyError:
        pass

    document = await db.subtraction.find_one_and_update({"_id": subtraction_id}, {
        "$set": update
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

    updated_count = await asyncio.shield(virtool.subtractions.db.delete(req.app, subtraction_id))

    if updated_count == 0:
        return not_found()

    return no_content()
