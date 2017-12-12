from cerberus import Validator

import virtool.app_settings
import virtool.utils
from virtool.handlers.utils import invalid_input, json_response, not_found, protected


async def get_all(req):
    amended = await virtool.app_settings.attach_virus_name(req.app["db"], req.app["settings"])
    return json_response(amended)


async def get_one(req):
    key = req.match_info["key"]

    if key not in virtool.app_settings.SCHEMA:
        return not_found("Unknown setting key")

    return json_response(req["settings"].data[key])


@protected("modify_settings")
async def update(req):
    """
    Update application settings based on request data.

    """
    data = await req.json()

    keys = data.keys()

    settings = req.app["settings"]

    v = Validator(virtool.app_settings.SCHEMA)

    if not v.validate(data):
        return invalid_input(v.errors)

    document = {key: v.document[key] for key in keys}

    settings.data.update(document)

    await settings.write()

    return json_response(settings.data)
