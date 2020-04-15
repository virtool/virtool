import virtool.http.routes
import virtool.utils
from virtool.api.response import json_response, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/processes")
async def find(req):
    db = req.app["db"]

    documents = [virtool.utils.base_processor(d) async for d in db.processes.find()]

    return json_response(documents)


@routes.get("/api/processes/{process_id}")
async def get(req):
    db = req.app["db"]

    process_id = req.match_info["process_id"]

    document = await db.processes.find_one(process_id)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))
