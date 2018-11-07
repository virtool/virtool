import os

import aiohttp

import virtool.http.routes
import virtool.resources
import virtool.settings
import virtool.utils
from virtool.api.utils import conflict, json_response

routes = virtool.http.routes.Routes()


@routes.get("/api/settings")
async def get(req):
    return json_response(req.app["settings"].data)


@routes.patch("/api/settings", admin=True, schema=virtool.settings.SCHEMA)
async def update(req):
    """
    Update application settings based on request data.

    """
    raw_data = await req.json()
    data = {key: req["data"][key] for key in raw_data}

    proc = data.get("proc", None)
    mem = data.get("mem", None)

    settings = req.app["settings"]

    error_message = virtool.settings.check_resource_limits(proc, mem, settings.data)

    if error_message:
        return conflict(error_message)

    proc = proc or settings["proc"]
    mem = mem or settings["mem"]

    error_message = virtool.settings.check_task_specific_limits(proc, mem, data)

    if error_message:
        return conflict(error_message)

    app_settings = req.app["settings"]

    app_settings.update(data)

    await app_settings.write()

    return json_response(app_settings.data)


@routes.get("/api/settings/proxy")
async def check_proxy(req):
    """
    Check that the proxy settings are working.

    :param req:
    :return:

    """
    settings = req.app["settings"]

    body = {
        "id": "proxy_failure"
    }

    if settings.get("proxy_enable"):

        url = "http://www.example.com"

        auth = None

        trust = settings.get("proxy_trust")

        if trust:
            address = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")

            if not address:
                return json_response(dict(body, message="Environmental variables not found"), status=400)

        else:
            address = settings.get("proxy_address", None)

            if not address:
                return json_response(dict(body, message="Proxy address is invalid"), status=400)

            if address:
                username = settings.get("proxy_username", None)
                password = settings.get("proxy_password", None)

                if username and password:
                    auth = aiohttp.BasicAuth(username, password)

        if address:
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.get(url, proxy=address, proxy_auth=auth) as resp:
                        if resp.status == 407:
                            return json_response(dict(body, message="Proxy authentication failed"), status=400)

                        if "Example" in await resp.text():
                            return json_response({"enabled": True})

                        return json_response(dict(body, message="Could not reach internet"), status=400)

                except aiohttp.ClientProxyConnectionError:
                    return json_response(dict(body, message="Could not connect to proxy"), status=400)

    return json_response(dict(body, message="Proxy use is not enabled"), status=400)
