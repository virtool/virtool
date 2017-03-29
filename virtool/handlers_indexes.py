from aiohttp import web
from virtool.utils import timestamp
from virtool.data_utils import get_new_id
from virtool.indexes import get_current_index_version


async def rebuild_index(req):
    """
    Starts a job to rebuild the viruses Bowtie2 index on disk. Does a check to make sure there are no unverified
    viruses in the collection and updates virus history to show the version and id of the new index.

    """
    # Check if any viruses are unverified.
    unverified_virus_count = await req.app["db"].viruses.find({"modified": True}).count()

    requesting_user = None

    if unverified_virus_count > 0:
        return web.json_response({
            "message": "There are unverified viruses",
            "count": unverified_virus_count
        }, status=400)

    index_version = await get_current_index_version(req.app["db"]) + 1

    index_id = await get_new_id(req.app["db"].indexes)

    await req.app["db"].indexes.insert({
        "_id": index_id,
        "index_version": index_version,
        "timestamp": timestamp(),
        "ready": False,
        "has_files": True,
        "username": requesting_user["_id"],
        "virus_count": None,
        "modification_count": None,
        "modified_virus_count": None,
        "_version": 0
    })

    # Update all history entries with no index_version to the new index version.
    await req.app["db"].history.update({"index": "unbuilt"}, {
        "$set": {
            "index": index_id,
            "index_version": index_version
        }
    })

    # Generate a dict of virus document version numbers keyed by the document id.
    virus_manifest = dict()

    virus_cursor = req.app["db"].viruses.find()

    while await virus_cursor.fetch_next:
        virus = virus_cursor.next_object()
        virus_manifest[virus["_id"]] = virus["_version"]

    # A dict of task_args for the rebuild job.
    task_args = {
        "username": requesting_user["_id"],
        "index_id": index_id,
        "index_version": index_version,
        "virus_manifest": virus_manifest
    }

    # Start the job.
    await req["job_manager"].new("rebuild_index", task_args, 2, 2, user["_id"])
