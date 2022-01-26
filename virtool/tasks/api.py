import virtool.tasks.pg
from virtool.api.response import NotFound, json_response
from virtool.http.routes import Routes

routes = Routes()


@routes.get("/tasks")
async def find(req):
    """
    Get a list of all task documents in the database.

    """
    documents = await virtool.tasks.pg.find(req.app["pg"])

    return json_response(documents)


@routes.get("/tasks/{task_id}")
async def get(req):
    """
    Get a complete task document.

    """
    task_id = req.match_info["task_id"]

    document = await virtool.tasks.pg.get(req.app["pg"], int(task_id))

    if not document:
        raise NotFound()

    return json_response(document)
