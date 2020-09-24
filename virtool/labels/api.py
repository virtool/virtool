import virtool.http.routes
import virtool.utils
import virtool.validators
import virtool.labels.checks
import virtool.db.utils
from virtool.api.response import bad_request, json_response, no_content, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/labels")
async def find(req):
    """
        Get a list of all label documents in the database.

    """
    db = req.app["db"]

    document = db.labels.find()

    return json_response([virtool.utils.base_processor(d) async for d in document])


@routes.get("/api/labels/{label_id}")
async def get(req):
    """
        Get a complete label document.

    """
    document = await req.app["db"].labels.find_one(req.match_info["label_id"])

    if not document:
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

    valid_color = await virtool.labels.checks.check_hex_color(req)

    if not valid_color:
        return bad_request("This is not a valid Hexadecimal color")

    name_exist = await db.labels.count_documents({'name': data['name']})

    if name_exist:
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
        "Location": "/api/labels/" + label_id
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

    if data["name"]:
        name_exist = await db.labels.count_documents({"_id": {"$ne": label_id}, "name": data["name"]})

        if name_exist:
            return bad_request("Label name already exists")

    if data["color"]:
        valid_color = await virtool.labels.checks.check_hex_color(req)

        if not valid_color:
            return bad_request("This is not a valid Hexadecimal color")

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

