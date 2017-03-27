import pymongo.errors

from aiohttp import web
from pymongo import ReturnDocument
from virtool.utils import timestamp
from virtool.data.utils import get_new_id


async def create_sample(req):
    """
    Creates a new sample based on the data in ``transaction`` and starts a sample import job.

    Ensures that a valid subtraction host was the submitted. Configures read and write permissions on the sample
    document and assigns it a creator username based on the connection attached to the transaction.

    """
    data = await req.json()

    # Check if the submitted sample name is unique if unique sample names are being enforced.
    if req["settings"].get("sample_unique_names") and await req["db"].samples.find({"name": data["name"]}).count():
        resp = web.json_response({"message": "Sample name already exists."})
        resp.set_status(400)
        return resp

    # Get a list of the subtraction hosts in MongoDB that are ready for use during analysis.
    available_subtraction_hosts = await req["db"].hosts.find().distinct("_id")

    # Make sure a subtraction host was submitted and it exists.
    if not data["subtraction"] or data["subtraction"] not in available_subtraction_hosts:
        resp = web.json_response({"message": "Could not find subtraction host or none was provided."})
        resp.set_status(400)
        return resp

    sample_id = await get_new_id(req["db"].samples)

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
        data["group"] = (await req["db"].users.find_one({"_id": user_id}))["primary_group"]

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

    await req["db"].samples.insert(data)

    await req["db"].files.reserve_files(data["files"])

    proc, mem = 2, 6

    await req["jobs"].new("import_reads", task_args, proc, mem, data["username"])

    data["sample_id"] = data.pop("sample_id")

    return web.json_response(data)


async def get_sample(req):
    """
    Get a complete sample document.
    
    """
    document = await req["db"].samples.find_one({"_id": req.match_info["sample_id"]})
    document["sample_id"] = document.pop("_id")
    return web.json_response(document)


async def update_sample(req):
    """
    Update specific fields in the sample document.

    """
    data = await req.json()

    valid_fields = ["name", "host", "isolate"]

    if not all(field in valid_fields for field in data.keys()):
        resp = web.json_response({"message": "Invalid field provided"})
        resp.set_status(400)
        return resp

    document = await req["db"].find_one_and_update({"_id": req.match_info["sample_id"]}, {
        "$set": {field: data[field] for field in valid_fields}
    }, return_document=ReturnDocument.AFTER)

    return web.json_response(document)


async def analyze(req):
    """
    Starts an analysis job for a given sample.

    """
    sample_id = req.match_info["sample_id"]
    data = await req.json()
    user_id = None

    # Generate a unique _id for the analysis entry
    analysis_id = await req["db"].analyses.new(
        sample_id,
        data["name"],
        user_id,
        data["algorithm"]
    )

    return web.json_response({"analysis_id": analysis_id})





