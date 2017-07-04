import os
import math
from pymongo import ReturnDocument
from cerberus import Validator

import virtool.file
import virtool.utils
import virtool.sample
import virtool.analysis
import virtool.sample_analysis
from virtool.handlers.utils import unpack_json_request, json_response, bad_request, not_found, invalid_input, \
    invalid_query, compose_regex_query


async def find(req):
    """
    List truncated virus documents.

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

    page = query["page"]
    per_page = query["per_page"]

    db_query = dict()

    if query["term"]:
        db_query.update(compose_regex_query(query["term"], ["name", "abbreviation"]))

    total_count = await db.samples.count()

    cursor = db.samples.find(
        db_query,
        virtool.sample.LIST_PROJECTION,
        sort=[("name", 1)]
    )

    found_count = await cursor.count()

    if page > 1:
        cursor.skip((page - 1) * per_page)

    documents = [virtool.sample.processor(document) for document in await cursor.to_list(per_page)]

    return json_response({
        "documents": documents,
        "total_count": total_count,
        "found_count": found_count,
        "page": page,
        "per_page": per_page,
        "page_count": int(math.ceil(found_count / per_page))
    })


async def upload(req):

    reader = await req.multipart()
    fastq = await reader.next()

    filename = req.query["name"]

    file_id = "{}-{}".format(await virtool.utils.get_new_id(req.app["db"].files), filename)

    while file_id in await req.app["db"].files.distinct("_id"):
        file_id = "{}-{}".format(await virtool.utils.get_new_id(req.app["db"].files), filename)

    file_path = os.path.join(req.app["settings"].get("data_path"), "files", file_id)

    document = {
        "_id": file_id,
        "name": filename,
        "type": "reads",
        "user_id": req["session"].user_id,
        "uploaded_at": virtool.utils.timestamp(),
        "created": False,
        "ready": False
    }

    await req.app["db"].files.insert_one(document)

    await req.app["dispatcher"].dispatch(
        "files",
        "update",
        virtool.file.processor({key: document[key] for key in virtool.file.LIST_PROJECTION if document.get(key, False)})
    )

    size = 0

    with open(file_path, "wb") as handle:
        while True:
            chunk = await fastq.read_chunk()
            if not chunk:
                break
            size += len(chunk)
            handle.write(chunk)

    return json_response({"complete": True})


async def create(req):
    data = await req.json()

    # Check if the submitted sample name is unique if unique sample names are being enforced.
    if req["settings"].get("sample_unique_names") and await req.app["db"].samples.count({"name": data["name"]}):
        return bad_request("Sample name already exists")

    # Get a list of the subtraction hosts in MongoDB that are ready for use during analysis.
    available_subtraction_hosts = await req.app["db"].hosts.distinct("_id")

    # Make sure a subtraction host was submitted and it exists.
    if not data["subtraction"] or data["subtraction"] not in available_subtraction_hosts:
        return bad_request("Could not find subtraction host or none was provided.")

    sample_id = await virtool.utils.get_new_id(req.app["db"].samples)

    user_id = None

    # Construct a new sample entry.
    data.update({
        "_id": sample_id,
        "user_id": user_id,
        "nuvs": False,
        "pathoscope": False
    })

    sample_group_setting = req["settings"].get("sample_group")

    # Assign the user"s primary group as the sample owner group if the ``sample_group`` settings is
    # ``users_primary_group``.
    if sample_group_setting == "users_primary_group":
        data["group"] = (await req.app["db"].users.find_one({"_id": user_id}))["primary_group"]

    # Make the owner group none if the setting is none.
    if sample_group_setting == "none":
        data["group"] = "none"

    # Add the default sample right fields to the sample document.
    data.update({
        "group_read": req["settings"].get("sample_group_read"),
        "group_write": req["settings"].get("sample_group_write"),
        "all_read": req["settings"].get("sample_all_read"),
        "all_write": req["settings"].get("sample_all_write")
    })

    task_args = dict(data)

    data.update({
        "added": virtool.utils.timestamp(),
        "format": "fastq",
        "imported": "ip",
        "quality": None,
        "analyzed": False,
        "hold": True,
        "archived": False
    })

    await req.app["db"].samples.insert_one(data)

    await virtool.file.reserve(req.app["db"], data["files"])

    proc, mem = 2, 6

    # await req["jobs"].new("import_reads", task_args, proc, mem, data["username"])

    data["sample_id"] = data.pop("sample_id")

    print(data)

    return json_response(data)


async def get(req):
    """
    Get a complete sample document.
    
    """
    document = await req.app["db"].samples.find_one({"_id": req.match_info["sample_id"]})

    if not document:
        return not_found()

    document["sample_id"] = document.pop("_id")

    return json_response(document)


async def update(req):
    """
    Update specific fields in the sample document.

    """
    data = await req.json()

    v = Validator({
        "name": {"type": "string"},
        "host": {"type": "string"},
        "isolate": {"type": "string"}
    })

    if not v(data):
        return invalid_input(v.errors)

    document = await req.app["db"].samples.find_one_and_update({"_id": req.match_info["sample_id"]}, {
        "$set": v.document
    }, return_document=ReturnDocument.AFTER, projection=virtool.sample.LIST_PROJECTION)

    processed = virtool.sample.processor(document)

    await req.app["dispatcher"].dispatch("sample", "update", processed)

    return json_response(processed)


async def set_owner_group(req):
    """
    Set the owner group for the sample.

    """
    sample_id = req.match_info["sample_id"]

    sample_owner = (await req.app["db"].users.find_one(sample_id, "user_id"))["user_id"]

    requesting_user = None

    if "administrator" not in requesting_user["groups"] and requesting_user["_id"] != sample_owner:
        return json_response({"message": "Must be administrator or sample owner."}, status=403)

    existing_group_ids = await req.app["db"].groups.distinct("_id")

    data = await req.json()

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


async def find_analyses(req):
    db = req.app["db"]

    sample_id = req.match_info["sample_id"]

    documents = await db.analyses.find({"sample_id": sample_id}, virtool.analysis.LIST_PROJECTION).to_list(None)

    processed = [virtool.analysis.processor(doc) for doc in documents]

    return json_response(processed, 200)


async def analyze(req):
    """
    Starts an analysis job for a given sample.

    """
    db, data = await unpack_json_request(req)

    sample_id = req.match_info["sample_id"]
    user_id = req["session"].user_id

    # Generate a unique _id for the analysis entry
    document = await virtool.sample_analysis.new(
        db,
        req.app["settings"],
        req.app["job_manager"],
        sample_id,
        user_id,
        data["algorithm"]
    )

    return json_response(document)


async def remove(req):
    """
    Remove a sample document and all associated analyses.

    """
    id_list = virtool.utils.coerce_list(req.match_info["_id"])

    result = await virtool.sample.remove_samples(id_list)
