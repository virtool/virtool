import virtool.http.routes
import virtool.utils
from virtool.api.response import json_response, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/tasks")
async def find(req):
    db = req.app["db"]

    documents = [virtool.utils.base_processor(d) async for d in db.tasks.find()]

    return json_response(documents)


@routes.get("/api/tasks/{task_id}")
async def get(req):
    db = req.app["db"]

    task_id = req.match_info["task_id"]

    document = await db.tasks.find_one(task_id)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))
