from virtool.data_utils import get_new_id
from virtool.handlers.utils import unpack_json_request, json_response, bad_request, not_found
from virtool import hosts


async def find(req):
    documents = await req.app["db"].hosts.find({}).to_list(length=10)
    return json_response(documents)


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

    return json_response(hosts.to_client(data))


async def get(req):
    """
    Get a complete host document.

    """
    document = await req.app["db"].hosts.find_one({"_id": req.match_info["host_id"]})

    if document:
        return json_response(document)

    return not_found()


async def remove(req):
    """
    Removes a host document its associated files.

    """
    host_id = req.match_info["host_id"]

    try:
        await hosts.remove(req.app["db"], req.app["settings"], host_id)
    except hosts.HostInUseError:
        return bad_request("Host is in use")
    except hosts.HostNotFoundError:
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
