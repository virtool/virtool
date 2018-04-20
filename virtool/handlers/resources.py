import virtool.job_resources
from virtool.handlers.utils import json_response


async def get(req):
    """
    Get a object describing compute resource usage on the server.

    """
    resources = virtool.job_resources.get()
    req.app["resources"] = resources

    return json_response(resources)
