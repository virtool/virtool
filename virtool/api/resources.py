import virtool.resources
from virtool.api.utils import json_response


async def get(req):
    """
    Get a object describing compute resource usage on the server.

    """
    resources = virtool.resources.get()
    req.app["resources"] = resources

    return json_response(resources)
