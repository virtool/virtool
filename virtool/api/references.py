import virtool.db.history
import virtool.db.refs
import virtool.db.utils
import virtool.kinds
import virtool.http.routes
import virtool.refs
import virtool.utils
from virtool.api.utils import compose_regex_query, json_response, not_found, paginate

routes = virtool.http.routes.Routes()


@routes.get("/api/refs")
async def find(req):
    db = req.app["db"]

    term = req.query.get("find", None)

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["name", "data_type"]))

    data = await paginate(db.refs, db_query, req.query, sort="name")

    return json_response(data)


@routes.get("/api/refs/{ref_id}")
async def get(req):
    """
    Get the complete representation of a specfic reference.

    """
    db = req.app["db"]

    document = await db.refs.find_one(req.match_info["ref_id"])

    if not document:
        return not_found()

    return json_response(document)


@routes.post("/api/refs", permission="create_ref", schema={
    "name": {
        "type": "string",
        "required": True
    },
    "description": {
        "type": "string",
        "default": ""
    },
    "data_type": {
        "type": "string",
        "allowed": ["genome", "barcode"],
        "default": "genome"
    },
    "organism": {
        "type": "string",
        "default": ""
    },
    "public": {
        "type": "boolean",
        "default": False
    }

})
async def create(req):
    db = req.app["db"]
    data = req["data"]

    user_id = req["client"].user_id

    clone_from = data.get("clone_from", None)

    if clone_from:
        document = await virtool.db.refs.clone(
            db,
            data["name"],
            clone_from,
            data["description"],
            data["public"],
            user_id
        )

    else:
        document = await virtool.db.refs.create_document(
            db,
            data["name"],
            data["organism"],
            data["description"],
            data["data_type"],
            data["public"],
            user_id=req["client"].user_id
        )

    await db.refs.insert_one(document)

    headers = {
        "Location": "/api/refs/" + document["_id"]
    }

    return json_response(virtool.utils.base_processor(document), headers=headers, status=201)


@routes.get("/api/refs/{ref_id}/unbuilt")
async def get_unbuilt_changes(req):
    """
    Get a JSON document describing the unbuilt changes that could be used to create a new index.

    """
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    history = await db.history.find({
        "ref.id": ref_id,
        "index.id": "unbuilt"
    }, virtool.db.history.LIST_PROJECTION).to_list(None)

    return json_response({
        "history": [virtool.utils.base_processor(c) for c in history]
    })
