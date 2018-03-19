import aiohttp
import aiohttp.client_exceptions
import os

import virtool.app_settings
import virtool.job_resources
import virtool.utils
from virtool.handlers.utils import conflict, json_response, protected, validation


async def get(req):
    amended = await virtool.app_settings.attach_virus_name(req.app["db"], req.app["settings"])
    return json_response(amended)


@protected("modify_settings")
@validation(virtool.app_settings.SCHEMA)
async def update(req):
    """
    Update application settings based on request data.

    """
    raw_data = await req.json()
    data = {key: req["data"][key] for key in raw_data}

    proc = data.get("proc", False)
    mem = data.get("mem", False)

    settings = req.app["settings"].data

    if proc or mem:

        resources = virtool.job_resources.get()

        if proc:
            if proc > len(resources["proc"]):
                return conflict("Exceeds system processor count")

            task_proc = max(settings[key] for key in virtool.app_settings.TASK_SPECIFIC_LIMIT_KEYS if "_proc" in key)

            if proc < task_proc:
                return conflict("Less than a task-specific proc limit")

        if mem:
            if mem > resources["mem"]["total"] / 1000000000:
                return conflict("Exceeds system memory")

            task_mem = max(settings[key] for key in virtool.app_settings.TASK_SPECIFIC_LIMIT_KEYS if "_mem" in key)

            if mem < task_mem:
                return conflict("Less than a task-specific mem limit")

    for key in virtool.app_settings.TASK_SPECIFIC_LIMIT_KEYS:
        if key in data:
            value = data[key]

            if "_proc" in key and value > proc:
                return conflict("Exceeds proc resource limit")

            if "_mem" in key and value > mem:
                return conflict("Exceeds mem resource specific limit")

    app_settings = req.app["settings"]

    app_settings.update(data)

    await app_settings.write()

    return json_response(app_settings.data)


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

                except aiohttp.client_exceptions.ClientProxyConnectionError:
                    return json_response(dict(body, message="Could not connect to proxy"), status=400)

    return json_response(dict(body, message="Proxy use is not enabled"), status=400)
