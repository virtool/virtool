import virtool.sample
import virtool.subtraction
from virtool.utils import get_new_id
from virtool.handlers.utils import unpack_json_request, json_response, bad_request, not_found


async def find(req):
    db = req.app["db"]

    total_count = await db.subtraction.count()

    host_count = await db.subtraction.count({"is_host": True})

    ready_host_count = await db.subtraction.count({"is_host": True, "ready": True})

    cursor = req.app["db"].subtraction.find({})

    found_count = await cursor.count()

    documents = [virtool.subtraction.processor(d) for d in await cursor.to_list(length=15)]

    return json_response({
        "documents": documents,
        "host_count": host_count,
        "total_count": total_count,
        "found_count": found_count,
        "ready_host_count": ready_host_count
    })


async def get(req):
    """
    Get a complete host document.

    """
    db = req.app["db"]

    subtraction_id = req.match_info["subtraction_id"]

    document = await db.subtraction.find_one(subtraction_id)

    if document:
        linked_samples = await db.samples.find({"subtraction": subtraction_id}, ["name"]).to_list(None)
        document["linked_samples"] = [virtool.sample.processor(d) for d in linked_samples]

        return json_response(virtool.subtraction.processor(document))

    return not_found()


async def create(req):
    """
    Adds a new host described by the transaction. Starts an :class:`.AddHost` job process.

    """
    db, data = await unpack_json_request(req)

    user_id = req["session"]["user_id"]

    job_id = await get_new_id(db.jobs)

    data.update({
        "_id": data.pop("organism"),
        "file_name": "-".join(data["file_id"].split("-")[1:]),
        "ready": False,
        "username": user_id,
        "job": job_id
    })

    await db.hosts.insert_one(data)

    await req.app["job_manager"].new(
        "add_host",
        data,
        1,
        4,
        user_id,
        job_id=job_id
    )

    return json_response(virtool.host.to_client(data))


async def remove(req):
    """
    Removes a host document its associated files.

    """
    host_id = req.match_info["host_id"]

    try:
        await virtool.host.remove(req.app["db"], req.app["settings"], host_id)
    except virtool.host.HostInUseError:
        return bad_request("Host is in use")
    except virtool.host.HostNotFoundError:
        return not_found()

    return json_response({"removed": host_id})


async def authorize_upload(req):
    db, data = await unpack_json_request(req)

    file_id = await db.files.register(
        name=data["name"],
        size=data["size"],
        file_type="host",
        expires=None
    )

    return json_response({"file_id": file_id})
