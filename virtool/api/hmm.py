import virtool.db.status
import virtool.http.routes
import virtool.db.hmm
import virtool.hmm
import virtool.utils
from virtool.api.utils import compose_regex_query, json_response, not_found, paginate

routes = virtool.http.routes.Routes()


@routes.get("/api/hmms")
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
        projection=virtool.db.hmm.PROJECTION,
        base_query={"hidden": False}
    )

    data["status"] = await db.status.find_one("hmm", {"_id": False})

    return json_response(data)


@routes.get("/api/hmms/{hmm_id}")
async def get(req):
    """
    Get a complete individual HMM annotation document.

    """
    document = await req.app["db"].hmm.find_one({"_id": req.match_info["hmm_id"]})

    if document is None:
        return not_found()

    return json_response(virtool.utils.base_processor(document))
