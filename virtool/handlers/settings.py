import aiohttp
import aiohttp.client_exceptions
import os
from cerberus import Validator

import virtool.app_settings
import virtool.utils
from virtool.handlers.utils import bad_request, invalid_input, json_response, not_found, protected


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


async def proxy(req):
    """
    Test that the proxy settings are working.

    :param req:
    :return:
    """
    settings = req.app["settings"]

    body = {
        "enabled": False,
        "example": False,
        "address": False,
        "auth": False,
        "env": False
    }

    if settings.get("proxy_enable"):
        data["enabled"] = True

        url = "http://www.example.com"

        auth = None

        trust = settings.get("proxy_trust")

        if trust:
            address = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
            data["env"] = bool(address)
        else:
            address = settings.get("proxy_address", None)

            if address:
                username = settings.get("username", None)
                password = settings.get("password", None)

                if username and password:
                    auth = aiohttp.BasicAuth(username, password)

        if address:
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.get(url, proxy=address, proxy_auth=auth) as resp:
                        if "Example" in await resp.text():
                            return json_response(dict(data, address=True, example=True))

                        data["address"] = True

                except aiohttp.client_exceptions.ClientProxyConnectionError:
                    data["address"] = False

    return json_response({
        "id": "proxy_failure",
        "message": "Proxy is not available or is misconfigured",
        "data": data
    }, status=400)
