from cerberus import Validator
from virtool.app_settings import SCHEMA
from virtool.handlers.utils import json_response, not_found, invalid_input


async def get_all(req):
    return json_response(req.app["settings"].data)


async def get_one(req):
    key = req.match_info["key"]

    if key not in SCHEMA:
        return not_found("Unknown setting key")

    return json_response(req["settings"].data[key])


async def update(req):
    """
    Update application settings based on request data.
    
    """
    data = await req.json()

    keys = data.keys()

    settings = req.app["settings"]

    v = Validator(SCHEMA)

    if not v.validate(data):
        return invalid_input(v.errors)

    document = {key: v.document[key] for key in keys}

    settings.data.update(document)

    await settings.write()

    return json_response(settings.data)
