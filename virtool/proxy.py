import aiohttp
import os
from aiohttp import web

import virtool.errors
from virtool.handlers.utils import json_response


def get_proxy_params(settings):
    auth = None
    address = None

    if settings.get("proxy_enable"):

        trust = settings.get("proxy_trust")

        if trust:
            address = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")

            if not address:
                raise virtool.errors.ProxyError("Environmental variables not found")

        else:
            address = settings.get("proxy_address", None)

            if not address:
                raise virtool.errors.ProxyError("No proxy address set")

            if address:
                username = settings.get("proxy_username", None)
                password = settings.get("proxy_password", None)

                if username and password:
                    auth = aiohttp.BasicAuth(username, password)

    return auth, address


class ProxyRequest:

    def __init__(self, settings, method, url, **kwargs):
        self.settings = settings
        self.method = method
        self.url = url
        self.resp = None
        self._kwargs = kwargs

    async def __aenter__(self):
        auth, address = get_proxy_params(self.settings)

        self.resp = await self.method(self.url, proxy=address, proxy_auth=auth, **self._kwargs)

        print(self.resp)

        if self.resp.status == 407:
            raise virtool.errors.ProxyError("Proxy authentication failed")

        return self.resp

    async def __aexit__(self, exc_type, exc_value, traceback):
        if exc_type is not None:
            print(exc_type, exc_value, traceback)

        self.resp.close()


@web.middleware
async def middleware(req, handler):
    try:
        return await handler(req)

    except virtool.errors.ProxyError as err:
        return json_response({
            "id": "proxy_error",
            "message": str(err)
        }, status=500)

    except aiohttp.client_exceptions.ClientProxyConnectionError:
        return json_response({
            "id": "proxy_error",
            "message": "Could not connect to proxy"
        }, status=500)
