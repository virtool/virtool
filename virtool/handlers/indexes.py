from pymongo import ReturnDocument

import virtool.utils
import virtool.virus_index
import virtool.virus_history
from virtool.handlers.utils import json_response, bad_request, not_found, protected


async def find(req):
    """
    Return a list of indexes.
    
    """
    db = req.app["db"]

    documents = await db.indexes.find({}, virtool.virus_index.PROJECTION, sort=[("index.version", -1)]).to_list(None)

    modified_virus_count = await db.viruses.count({"modified": True})
    total_virus_count = await db.viruses.count()

    return json_response({
        "documents": [virtool.utils.base_processor(d) for d in documents],
        "modified_virus_count": modified_virus_count,
        "total_virus_count": total_virus_count
    })


async def get(req):
    """
    Get the complete document for a given index.
    
    """
    db = req.app["db"]

    index_id_or_version = req.match_info["index_id_or_version"]

    try:
        document = await db.indexes.find_one({"version": int(index_id_or_version)})
    except ValueError:
        document = await db.indexes.find_one(index_id_or_version)

    if not document:
        return not_found()

    document = virtool.utils.base_processor(document)

    changes = await db.history.find({"index.id": document["id"]}, virtool.virus_history.LIST_PROJECTION).to_list(None)

    document["changes"] = [virtool.utils.base_processor(c) for c in changes]

    return json_response(document)


@protected("rebuild_index")
async def create(req):
    """
    Starts a job to rebuild the viruses Bowtie2 index on disk. Does a check to make sure there are no unverified
    viruses in the collection and updates virus history to show the version and id of the new index.

    """
    db = req.app["db"]

    if await db.viruses.find({"modified": True}).count():
        return bad_request("There are unverified viruses")

    index_id = await virtool.utils.get_new_id(db.indexes)
    index_version = await virtool.virus_index.get_current_index_version(db) + 1

    user_id = req["session"].user_id

    await db.indexes.insert_one({
        "_id": index_id,
        "version": index_version,
        "created_at": virtool.utils.timestamp(),
        "virus_count": None,
        "modification_count": None,
        "modified_virus_count": None,
        "ready": False,
        "has_files": True,
        "user": {
            "id": user_id
        },
        "job": {
            "id": None
        }
    })

    # Update all history entries with no index_version to the new index version.
    await db.history.update_many({"index": "unbuilt"}, {
        "$set": {
            "index": {
                "id": index_id,
                "version": index_version
            }
        }
    })

    # Generate a dict of virus document version numbers keyed by the document id.
    virus_manifest = dict()

    async for document in db.viruses.find({}, ["_id", "version"]):
        virus_manifest[document["_id"]] = document["version"]

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
            "job": job_id
        }
    }, return_document=ReturnDocument.AFTER)

    return {
        virtool.utils.base_processor(document)
    }


def find_history(req):
    pass
