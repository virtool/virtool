import virtool.http.routes
import virtool.tasks.pg
import virtool.utils
from virtool.api.response import json_response, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/tasks")
async def find(req):
    """
    Get a list of all task documents in the database.

    """
    documents = await virtool.tasks.pg.find(req.app["pg"])

    return json_response(documents)


@routes.get("/api/tasks/{task_id}")
async def get(req):
    """
    Get a complete task document.

    """
    task_id = req.match_info["task_id"]

    document = await virtool.tasks.pg.get(req.app["pg"], int(task_id))

    if not document:
        return not_found()

    return json_response(document)
