from pymongo import ReturnDocument
from virtool.utils import timestamp
from virtool.utils import get_new_id, coerce_list
from virtool.handlers.utils import json_response, bad_request, not_found
from virtool.sample import get_sample_owner, remove_samples


async def find(req):
    pass


async def create(req):
    """
    Creates a new sample based on the data in ``transaction`` and starts a sample import job.

    Ensures that a valid subtraction host was the submitted. Configures read and write permissions on the sample
    document and assigns it a creator username based on the connection attached to the transaction.

    """
    data = await req.json()

    # Check if the submitted sample name is unique if unique sample names are being enforced.
    if req["settings"].get("sample_unique_names") and await req.app["db"].samples.find({"name": data["name"]}).count():
        return bad_request("Sample name already exists")

    # Get a list of the subtraction hosts in MongoDB that are ready for use during analysis.
    available_subtraction_hosts = await req.app["db"].hosts.find().distinct("_id")

    # Make sure a subtraction host was submitted and it exists.
    if not data["subtraction"] or data["subtraction"] not in available_subtraction_hosts:
        return bad_request("Could not find subtraction host or none was provided.")

    sample_id = await get_new_id(req.app["db"].samples)

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
        "added": timestamp(),
        "format": "fastq",
        "imported": "ip",
        "quality": None,
        "analyzed": False,
        "hold": True,
        "archived": False
    })

    await req.app["db"].samples.insert(data)

    await req.app["db"].files.reserve_files(data["files"])

    proc, mem = 2, 6

    await req["jobs"].new("import_reads", task_args, proc, mem, data["username"])

    data["sample_id"] = data.pop("sample_id")

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

    valid_fields = ["name", "host", "isolate"]

    if not all(field in valid_fields for field in data.keys()):
        return bad_request("Invalid field provided")

    document = await req.app["db"].find_one_and_update({"_id": req.match_info["sample_id"]}, {
        "$set": {field: data[field] for field in valid_fields}
    }, return_document=ReturnDocument.AFTER)

    return json_response(document)


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

    await req.app["db"].samples.update({"_id": sample_id}, {
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
    if "administrator" in user_groups or user_id == await get_sample_owner(req.app["db"], sample_id):
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


async def analyze(req):
    """
    Starts an analysis job for a given sample.

    """
    sample_id = req.match_info["sample_id"]
    data = await req.json()
    user_id = None

    # Generate a unique _id for the analysis entry
    analysis_id = await req.app["db"].analyses.new(
        sample_id,
        data["name"],
        user_id,
        data["algorithm"]
    )

    return json_response({"analysis_id": analysis_id})


async def remove(req):
    """
    Remove a sample document and all associated analyses.

    """
    id_list = coerce_list(req.match_info["_id"])

    result = await remove_samples(id_list)
