import virtool.db.history
import virtool.db.indexes
import virtool.db.utils
import virtool.history
import virtool.jobs.build_index
import virtool.utils
from virtool.api.utils import json_response, bad_request, not_found, compose_regex_query, paginate, \
    conflict


async def find(req):
    """
    Return a list of indexes.

    """
    db = req.app["db"]

    data = await paginate(
        db.indexes,
        {},
        req.query,
        sort="version",
        projection=virtool.db.indexes.PROJECTION,
        reverse=True
    )

    for document in data["documents"]:
        modified_kind_count, change_count = await virtool.db.indexes.get_modification_stats(db, document["id"])

        document.update({
            "modified_kind_count": modified_kind_count,
            "change_count": change_count
        })

    data.update({
        "unbuilt_change_count": len(await db.history.distinct("kind.id", {"index.id": "unbuilt"})),
        "total_kind_count": await db.kinds.count()
    })

    return json_response(data)


async def get(req):
    """
    Get the complete document for a given index.

    """
    db = req.app["db"]

    document = await virtool.db.indexes.get_index(db, req.match_info["index_id_or_version"])

    if not document:
        return not_found()

    document = virtool.utils.base_processor(document)

    document["contributors"] = await virtool.db.indexes.get_contributors(db, document["id"])

    document["change_count"] = sum(v["count"] for v in document["kinds"])

    return json_response(document)


async def create(req):
    """
    Starts a job to rebuild the kinds Bowtie2 index on disk. Does a check to make sure there are no unverified
    kinds in the collection and updates kind history to show the version and id of the new index.

    """
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    if await db.indexes.count({"ref.id": ref_id, "ready": False}):
        return conflict("Index build already in progress")

    if await db.kinds.count({"ref.id": ref_id, "verified": False}):
        return bad_request("There are unverified kinds")

    if not await db.history.count({"ref.id": ref_id, "index.id": "unbuilt"}):
        return bad_request("There are no unbuilt changes")

    index_id = await virtool.db.utils.get_new_id(db.indexes)

    index_version = await virtool.db.indexes.get_next_version(db, ref_id)

    user_id = req["client"].user_id

    job_id = await virtool.db.utils.get_new_id(db.jobs)

    manifest = await virtool.db.indexes.create_manifest(db, ref_id)

    document = {
        "_id": index_id,
        "version": index_version,
        "created_at": virtool.utils.timestamp(),
        "manifest": await virtool.db.indexes.create_manifest(db, ref_id),
        "ready": False,
        "has_files": True,
        "job": {
            "id": job_id
        },
        "ref": {
            "id": ref_id
        },
        "user": {
            "id": user_id
        }
    }

    await db.indexes.insert_one(document)

    # A dict of task_args for the rebuild job.
    task_args = {
        "ref_id": ref_id,
        "user_id": user_id,
        "index_id": index_id,
        "index_version": index_version,
        "manifest": manifest
    }

    # Start the job.
    await req.app["job_manager"].new("rebuild_index", task_args, user_id, job_id=job_id)

    headers = {
        "Location": "/api/indexes/" + index_id
    }

    return json_response(virtool.utils.base_processor(document), status=201, headers=headers)


async def find_history(req):
    """
    Find history changes for a specific index.

    """
    db = req.app["db"]

    document = await virtool.db.indexes.get_index(db, req.match_info["index_id_or_version"], projection=["_id"])

    if not document:
        return not_found()

    term = req.query.get("term", None)

    db_query = {
        "index.id": document["_id"]
    }

    if term:
        db_query.update(compose_regex_query(term, ["kind.name", "user.id"]))

    data = await paginate(
        db.history,
        db_query,
        req.query,
        sort=[("kind.name", 1), ("kind.version", -1)],
        projection=virtool.db.history.LIST_PROJECTION,
        reverse=True
    )

    return json_response(data)
