import virtool.http.routes
import virtool.resources
from virtool.api.utils import json_response

routes = virtool.http.routes.Routes()


@routes.get("/api/jobs/resources")
async def get(req):
    """
    Get a object describing compute resource usage on the server.

    """
    resources = virtool.resources.get()
    req.app["resources"] = resources

    return json_response(resources)
