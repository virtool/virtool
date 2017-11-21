import asyncio
import os
import pymongo

import virtool.utils
import virtool.virus_hmm
from virtool.handlers.utils import compose_regex_query, json_response, not_found, paginate


async def find(req):
    """
    Find HMM annotation documents.

    """

    db = req.app["db"]

    term = req.query.get("find", None)

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["label"]))

    data = await paginate(
        db.hmm,
        db_query,
        req.query,
        "cluster",
        projection=virtool.virus_hmm.PROJECTION,
        base_query={"hidden": False}
    )

    profiles_path = os.path.join(req.app["settings"].get("data_path"), "hmm", "profiles.hmm")

    data["file_exists"] = os.path.isfile(profiles_path)

    return json_response(data)


async def install(req):
    db = req.app["db"]

    document = await db.status.find_one_and_update({"_id": "hmm_install"}, {
        "$set": {
            "ready": False,
            "process": {}
        }
    }, return_document=pymongo.ReturnDocument.AFTER, upsert=True)

    asyncio.ensure_future(virtool.virus_hmm.install_official(
        req.app.loop,
        db,
        req.app["settings"],
        req.app["dispatcher"].dispatch,
        req.app["version"]
    ), loop=req.app.loop)

    return json_response(virtool.utils.base_processor(document))


async def get_annotation(req):
    """
    Get a complete individual HMM annotation document.

    """
    document = await req.app["db"].hmm.find_one({"_id": req.match_info["hmm_id"]})

    if document:
        return json_response(virtool.utils.base_processor(document))

    return not_found()


async def get_file(req):
    db = req.app["db"]

    hmm_dir_path = os.path.join(req.app["settings"].get("data_path"), "hmm")

    if not os.path.isdir(hmm_dir_path):
        os.mkdir(hmm_dir_path)

    hmm_file_path = os.path.join(hmm_dir_path, "profiles.hmm")

    try:
        hmm_stats = await virtool.virus_hmm.hmmstat(req.app.loop, hmm_file_path)
    except FileNotFoundError:
        return not_found("profiles.hmm file does not exist")

    annotations = await db.hmm.find({}, ["cluster", "count", "length"]).to_list(None)

    clusters_in_file = {entry["cluster"] for entry in hmm_stats}
    clusters_in_database = {entry["cluster"] for entry in annotations}

    # Calculate which cluster ids are unique to the HMM file and/or the annotation database.
    errors["not_in_file"] = list(clusters_in_database - clusters_in_file) or False
    errors["not_in_database"] = list(clusters_in_file - clusters_in_database) or False

    await db.status.update_one("hmm", {
        "$set": errors
    }, upsert=True)

    return errors
