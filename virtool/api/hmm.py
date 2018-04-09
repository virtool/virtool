import asyncio
import os

import pymongo

import virtool.hmm
import virtool.utils
from virtool.api.utils import compose_regex_query, json_response, not_found, paginate, protected


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
        projection=virtool.hmm.PROJECTION,
        base_query={"hidden": False}
    )

    profiles_path = os.path.join(req.app["settings"].get("data_path"), "hmm", "profiles.hmm")

    data["file_exists"] = os.path.isfile(profiles_path)

    return json_response(data)


async def get(req):
    """
    Get a complete individual HMM annotation document.

    """
    document = await req.app["db"].hmm.find_one({"_id": req.match_info["hmm_id"]})

    if document:
        return json_response(virtool.utils.base_processor(document))

    return not_found()


async def get_install(req):
    db = req.app["db"]

    document = await db.status.find_one({"_id": "hmm_install"})

    if not document:
        document = {
            "_id": "hmm_install",
            "download_size": None,
            "ready": False,
            "process": {
                "progress": 0,
                "step": "check_github"
            }
        }

        await db.status.insert_one(document)

    return json_response(virtool.utils.base_processor(document))


@protected("modify_hmm")
async def install(req):
    db = req.app["db"]

    document = await db.status.find_one_and_update({"_id": "hmm_install"}, {
        "$set": {
            "download_size": None,
            "ready": False,
            "process": {
                "progress": 0,
                "step": "check_github"
            }
        }
    }, return_document=pymongo.ReturnDocument.AFTER, upsert=True)

    asyncio.ensure_future(virtool.hmm.install_official(
        req.app.loop,
        db,
        req.app["settings"],
        req.app["dispatcher"].dispatch,
        req.app["version"]
    ), loop=req.app.loop)

    return json_response(virtool.utils.base_processor(document))
