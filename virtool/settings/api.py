import virtool.http.routes
import virtool.settings.db
import virtool.settings.schema
import virtool.utils
from virtool.api.response import json_response
from virtool.http.schema import schema

routes = virtool.http.routes.Routes()


@routes.get("/api/settings")
@routes.jobs_api.get("/api/settings")
async def get(req):
    settings = await virtool.settings.db.get(req.app["db"])

    return json_response({
        **settings,
        **{key: req.app["settings"].get(key) for key in virtool.settings.db.CONFIG_PROJECTION}
    })


@routes.patch("/api/settings", admin=True)
@schema(virtool.settings.schema.SCHEMA)
async def update(req):
    """
    Update application settings based on request data.

    """
    raw_data = await req.json()

    data = {key: req["data"][key] for key in raw_data}

    settings = await virtool.settings.db.update(req.app["db"], data)

    req.app["settings"].update(settings)

    return json_response({
        **settings,
        **{key: req.app["settings"][key] for key in virtool.settings.db.CONFIG_PROJECTION}
    })
