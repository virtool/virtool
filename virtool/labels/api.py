import virtool.http.routes
import virtool.utils
import virtool.validators
import virtool.db.utils
from virtool.api.response import bad_request, json_response, no_content, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/labels")
async def find(req):
    """
        Get a list of all label documents in the database.

    """
    db = req.app["db"]

    cursor = db.labels.find()

    return json_response([virtool.utils.base_processor(d) async for d in cursor])


@routes.get("/api/labels/{label_id}")
async def get(req):
    """
        Get a complete label document.

    """
    document = await req.app["db"].labels.find_one(req.match_info["label_id"])

    if document is None:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@routes.post("/api/labels", schema={
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "required": True,
        "empty": False
    },
    "color": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "validator": virtool.validators.is_valid_hex_color,
        "default": "#A0AEC0"
    },
    "description": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": ""
    }
})
async def create(req):
    """
        Add a new label to the labels database.

    """
    db = req.app["db"]
    data = req["data"]

    if await db.labels.count_documents({'name': data['name']}):
        return bad_request("Label name already exists")

    label_id = await virtool.db.utils.get_new_id(db.labels)

    document = {
        "_id": label_id,
        "name": data["name"],
        "color": data["color"],
        "description": data["description"]
    }

    await db.labels.insert_one(document)

    headers = {
        "Location": f"/api/labels/{label_id}"
    }

    return json_response(virtool.utils.base_processor(document), status=201, headers=headers)


@routes.patch("/api/labels/{label_id}", schema={
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
    },
    "color": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "validator": virtool.validators.is_valid_hex_color,
    },
    "description": {
        "type": "string",
        "coerce": virtool.validators.strip,
    }
})
async def edit(req):
    """
        Edit an existing label.

    """
    db = req.app["db"]
    data = req["data"]

    label_id = req.match_info["label_id"]

    if "name" in data and await db.labels.count_documents({"_id": {"$ne": label_id}, "name": data["name"]}):
        return bad_request("Label name already exists")

    document = await db.labels.find_one_and_update({"_id": label_id}, {
        "$set": data
    })

    if document is None:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@routes.delete("/api/labels/{label_id}")
async def remove(req):
    """
        Remove a label.

    """
    db = req.app["db"]

    label_id = req.match_info["label_id"]

    delete_result = await db.labels.delete_one({"_id": label_id})

    if delete_result.deleted_count == 0:
        return not_found()

    return no_content()

