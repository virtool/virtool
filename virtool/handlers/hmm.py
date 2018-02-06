import asyncio
import os
import pymongo

import virtool.utils
import virtool.virus_hmm
from virtool.handlers.utils import compose_regex_query, json_response, not_found, paginate, protected


async def find(req):
    """
    Find HMM annotation documents.

    """

    db = req.app["db"]

    term = req.query.get("find", None)

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["names"]))

    data = await paginate(
        db.hmm,
        db_query,
        req.query,
        sort="cluster",
        projection=virtool.virus_hmm.PROJECTION,
        base_query={"hidden": False}
    )

    profiles_path = os.path.join(req.app["settings"].get("data_path"), "hmm", "profiles.hmm")

    data["file_exists"] = os.path.isfile(profiles_path)

    return json_response(data)


@protected("modify_hmm")
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
