import virtool.db.settings
import virtool.http.routes
import virtool.resources
import virtool.settings
import virtool.utils
from virtool.api.utils import json_response

routes = virtool.http.routes.Routes()


@routes.get("/api/settings")
async def get(req):
    return json_response(req.app["settings"].as_dict())


@routes.patch("/api/settings", admin=True, schema=virtool.settings.API_SCHEMA)
async def update(req):
    """
    Update application settings based on request data.

    """
    raw_data = await req.json()

    data = {key: req["data"][key] for key in raw_data}

    settings = req.app["settings"]

    await virtool.db.settings.update(req.app["db"], data)

    await settings.load_from_db()

    return json_response(settings.as_dict())
