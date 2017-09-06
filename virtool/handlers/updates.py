import virtool.app
import virtool.updates
from virtool.handlers.utils import json_response


async def get(req):
    settings = req.app["settings"]

    repo = settings.get("software_repo")
    server_version = virtool.app.find_server_version()

    releases = await virtool.updates.get_releases(repo, server_version)

    return json_response({
        "releases": releases,
        "current_version": server_version
    })
