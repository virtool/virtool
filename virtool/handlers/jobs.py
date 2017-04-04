import os
from cerberus import Validator

import virtool.utils
from virtool.jobs.manager import processor, dispatch_projection, dispatch_processor
from virtool.handlers.utils import unpack_json_request, json_response, bad_request, not_found, invalid_input


async def find(req):
    """
    Return a list of job documents.
     
    """
    documents = await req.app["db"].jobs.find({}, dispatch_projection).to_list(15)
    return json_response([processor(document) for document in documents])


async def get(req):
    """
    Return the complete document for a given job.

    """
    job_id = req.match_info["job_id"]

    document = await req.app["db"].find_one(job_id)

    if not document:
        return not_found()

    return json_response(processor(document))


async def cancel(req):
    """
    Cancel a job.

    """
    db, data = await unpack_json_request(req)

    job_id = req.match_info["job_id"]

    v = Validator({
        "cancel": {"type": "boolean", "allowed": [True]}
    })

    if not v(data):
        return invalid_input("Expected {'cancel': true}")

    document = await db.find_one(job_id)

    if not document:
        return not_found()

    if not document["status"][-1]["state"] in ["waiting", "running"]:
        return bad_request("Not cancellable")

    await req.app["job_manager"].cancel(job_id)

    document = await db.find_one(job_id)

    return json_response(processor(document))


async def remove_job(req):
    """
    Remove a job.

    """
    db = req.app["db"]

    job_id = req.match_info["job_id"]

    document = await db.find_one(job_id)

    if not document:
        return not_found()

    if not document["status"][-1]["state"] in ["waiting", "running"]:
        return bad_request("Not cancellable")

    # Removed the documents associated with the job ids from the database.
    await db.jobs.delete_one({"_id": job_id})

    try:
        # Calculate the log path and remove the log file. If it exists, return True.
        path = os.path.join(req.app["settings"].get("data_path"), "logs", "jobs", job_id + ".log")
        await virtool.utils.rm(path)
    except OSError:
        pass

    return json_response({
        "removed": job_id
    })
