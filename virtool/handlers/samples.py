from copy import deepcopy
from pymongo import ReturnDocument
from cerberus import Validator

import virtool.file
import virtool.utils
import virtool.sample
import virtool.sample_analysis
from virtool.handlers.utils import unpack_request, json_response, bad_request, not_found, invalid_input, \
    invalid_query, compose_regex_query, paginate, protected, validation, no_content, conflict


async def find(req):
    """
    Find samples, filtering by data passed as URL parameters.

    """
    db = req.app["db"]

    # Validator for URL query.
    v = Validator({
        "term": {"type": "string", "default": "", "coerce": str},
        "page": {"type": "integer", "coerce": int, "default": 1, "min": 1},
        "per_page": {"type": "integer", "coerce": int, "default": 15, "min": 1, "max": 100}
    })

    if not v(dict(req.query)):
        return invalid_query(v.errors)

    query = v.document

    db_query = dict()

    if query["term"]:
        db_query.update(compose_regex_query(query["term"], ["name", "user.id"]))

    data = await paginate(db.samples, db_query, req.query, "name", projection=virtool.sample.LIST_PROJECTION)

    return json_response(data)


async def get(req):
    """
    Get a complete sample document.

    """
    document = await req.app["db"].samples.find_one(req.match_info["sample_id"])

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@protected("create_sample")
@validation({
    "name": {"type": "string", "required": True},
    "host": {"type": "string"},
    "isolate": {"type": "string"},
    "group": {"type": "string"},
    "locale": {"type": "string"},
    "subtraction": {"type": "string", "required": True},
    "files": {"type": "list", "required": True}
})
async def create(req):
    db, data = await unpack_request(req)

    if req.app["settings"].get("sample_group") == "force_choice":
        try:
            if not await db.groups.count({"_id": data["group"]}):
                return not_found("Group '{}' not found".format(data["group"]))
        except KeyError:
            return bad_request("Server requires a 'group' field for sample creation")

    # Check if the submitted sample name is unique if unique sample names are being enforced.
    if await db.samples.count({"lower_name": data["name"].lower()}):
        return conflict("Sample name '{}' already exists".format(data["name"]))

    # Make sure a subtraction host was submitted and it exists.
    if data["subtraction"] not in await db.subtraction.find({"is_host": True}).distinct("_id"):
        return not_found("Subtraction host '{}' not found".format(data["subtraction"]))

    # Make sure all of the passed file ids exist.
    if await db.files.count({"_id": {"$in": data["files"]}}) != len(data["files"]):
        return not_found("One or more of the passed file ids do(es) not exist")

    sample_id = await virtool.utils.get_new_id(db.samples)

    user_id = req["session"].user_id

    document = deepcopy(data)

    settings = req.app["settings"]

    sample_group_setting = settings.get("sample_group")

    # Assign the user"s primary group as the sample owner group if the ``sample_group`` settings is
    # ``users_primary_group``.
    if sample_group_setting == "users_primary_group":
        document["group"] = (await db.users.find_one(user_id, ["primary_group"]))["primary_group"]

    # Make the owner group none if the setting is none.
    elif sample_group_setting == "none":
        document["group"] = "none"

    document.update({
        "_id": sample_id,
        "nuvs": False,
        "pathoscope": False,
        "created_at": virtool.utils.timestamp(),
        "format": "fastq",
        "imported": "ip",
        "quality": None,
        "analyzed": False,
        "hold": True,
        "archived": False,
        "group_read": settings.get("sample_group_read"),
        "group_write": settings.get("sample_group_write"),
        "all_read": settings.get("sample_all_read"),
        "all_write": settings.get("sample_all_write"),
        "subtraction": {
            "id": data["subtraction"]
        },
        "user": {
            "id": user_id
        }
    })

    await db.samples.insert_one(document)

    await virtool.file.reserve(db, data["files"])

    task_args = {
        "sample_id": sample_id,
        "files": document["files"]
    }

    await req.app["job_manager"].new("create_sample", task_args, document["user"]["id"])

    return json_response(virtool.utils.base_processor(document))


@validation({
    "name": {"type": "string"},
    "host": {"type": "string"},
    "isolate": {"type": "string"}
})
async def edit(req):
    """
    Update specific fields in the sample document.

    """
    db, data = await unpack_request(req)

    document = await db.samples.find_one_and_update({"_id": req.match_info["sample_id"]}, {
        "$set": v.document
    }, return_document=ReturnDocument.AFTER, projection=virtool.sample.LIST_PROJECTION)

    processed = virtool.utils.base_processor(document)

    await req.app["dispatcher"].dispatch("sample", "update", processed)

    return json_response(processed)


async def set_owner_group(req):
    """
    Set the owner group for the sample.

    """
    db, data = await unpack_request(req)

    sample_id = req.match_info["sample_id"]

    sample_owner = (await db.users.find_one(sample_id, "user_id"))["user_id"]

    requesting_user = None

    if "administrator" not in requesting_user["groups"] and requesting_user["_id"] != sample_owner:
        return json_response({"message": "Must be administrator or sample owner."}, status=403)

    existing_group_ids = await db.groups.distinct("_id")

    if data["group_id"] not in existing_group_ids:
        return not_found("Group does not exist")

    await req.app["db"].samples.update_one({"_id": sample_id}, {
        "$set": {
            "group_id": data["group_id"]
        }
    })

    return json_response({"group_id": data["group_id"]})


async def set_rights(req):
    """
    Change rights setting for the specified sample document.

    """
    data = await req.json()

    user_id = req["session"].user_id
    user_groups = req["session"].groups

    sample_id = req.match_info["sample_id"]

    # Only update the document if the connected user owns the samples or is an administrator.
    if "administrator" in user_groups or user_id == await virtool.sample.get_sample_owner(req.app["db"], sample_id):
        valid_fields = ["all_read", "all_write", "group_read", "group_write"]

        # Make a dict for updating the rights fields. Fail the transaction if there is an unknown right key.
        if any(field not in valid_fields for field in data.keys()):
            return bad_request("Unknown right name.")

        # Update the sample document with the new rights.
        document = await req.app["db"].find_one_and_update(data["_id"], {
            "$set": data["changes"]
        })

        return json_response({field: document[field] for field in valid_fields})

    return json_response({"message": "Must be administrator or sample owner."}, status=403)


async def remove(req):
    """
    Remove a sample document and all associated analyses.

    """
    delete_result = await virtool.sample.remove_samples(
        req.app["db"],
        req.app["settings"],
        [req.match_info["sample_id"]]
    )

    if not delete_result.deleted_count:
        return not_found()

    return no_content()


async def list_analyses(req):
    """
    List the analyses associated with the given ``sample_id``.

    """
    db = req.app["db"]

    sample_id = req.match_info["sample_id"]

    if not await db.samples.count({"_id": sample_id}):
        return not_found()

    documents = await db.analyses.find({"sample.id": sample_id}, virtool.sample_analysis.LIST_PROJECTION).to_list(None)

    return json_response({
        "total_count": len(documents),
        "documents": [virtool.utils.base_processor(d) for d in documents]
    })


@validation({
    "algorithm": {"type": "string", "required": True}
})
async def analyze(req):
    """
    Starts an analysis job for a given sample.

    """
    db, data = await unpack_request(req)

    sample_id = req.match_info["sample_id"]

    if not await db.samples.count({"_id": sample_id}):
        return not_found()

    # Generate a unique _id for the analysis entry
    document = await virtool.sample_analysis.new(
        db,
        req.app["settings"],
        req.app["job_manager"],
        sample_id,
        req["session"].user_id,
        data["algorithm"]
    )

    return json_response(
        virtool.utils.base_processor(document),
        status=201,
        headers={
            "Location": "/api/analyses/{}".format(document["_id"])
        }
    )
