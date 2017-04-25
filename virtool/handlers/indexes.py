from pymongo import ReturnDocument

from virtool.handlers.utils import unpack_json_request, json_response, bad_request, not_found, protected
from virtool.utils import timestamp
from virtool.utils import get_new_id
from virtool.virus_indexes import get_current_index_version, projection, processor


async def find(req):
    """
    Return a list of recorded indexes.
    
    """
    return json_response(await req["db"].indexes.find().to_list(10))


async def get(req):
    """
    Get the complete document for a given index.
    
    """
    index_id = req.match_info["index_id"]

    document = await req["db"].find_one(index_id, projection=projection)

    if not document:
        return not_found()

    return json_response(processor(document))


@protected("rebuild_index")
async def create(req):
    """
    Starts a job to rebuild the viruses Bowtie2 index on disk. Does a check to make sure there are no unverified
    viruses in the collection and updates virus history to show the version and id of the new index.

    """
    db, data = await unpack_json_request(req)

    if await db.viruses.find({"modified": True}).count():
        return bad_request("There are unverified viruses")

    index_id = await get_new_id(db.indexes)
    index_version = await get_current_index_version(db) + 1

    user_id = req["session"].user_id

    await db.indexes.insert_one({
        "_id": index_id,
        "index_version": index_version,
        "timestamp": timestamp(),
        "ready": False,
        "has_files": True,
        "user_id": user_id,
        "job_id": None,
        "virus_count": None,
        "modification_count": None,
        "modified_virus_count": None,
    })

    # Update all history entries with no index_version to the new index version.
    await db.history.update_many({"index": "unbuilt"}, {
        "$set": {
            "index": index_id,
            "index_version": index_version
        }
    })

    # Generate a dict of virus document version numbers keyed by the document id.
    virus_manifest = dict()

    async for document in db.viruses.find({}, ["_id", "_version"]):
        virus_manifest[document["_id"]] = document["_version"]

    # A dict of task_args for the rebuild job.
    task_args = {
        "user_id": user_id,
        "index_id": index_id,
        "index_version": index_version,
        "virus_manifest": virus_manifest
    }

    # Start the job.
    job_id = await req["job_manager"].new("rebuild_index", task_args, 2, 2, user_id)

    document = await db.indexes.find_one_and_update({"_id": index_id}, {
        "$set": {
            "job_id": job_id
        }
    }, return_document=ReturnDocument.AFTER)

    return {
        processor(document)
    }
