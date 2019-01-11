import os

import aiohttp
from aiohttp import web

import virtool.errors
from virtool.api.utils import json_response


class ProxyRequest:

    def __init__(self, settings, method, url, **kwargs):
        self.settings = settings
        self.method = method
        self.url = url
        self.resp = None
        self._kwargs = kwargs

    async def __aenter__(self):
        auth, address = self.get_proxy_params(self.settings)

        self.resp = await self.method(self.url, proxy=address, proxy_auth=auth, **self._kwargs)

        if self.resp.status == 407:
            raise virtool.errors.ProxyError("Proxy authentication failed")

        return self.resp

    async def __aexit__(self, exc_type, exc_value, traceback):
        if exc_type is not None:
            print(exc_type, exc_value, traceback)

        self.resp.close()

    @staticmethod
    def get_proxy_params(settings):
        auth = None
        address = None

        if settings["proxy_enable"]:

            trust = settings["proxy_trust"]

            if trust:
                address = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")

                if not address:
                    raise virtool.errors.ProxyError("Environmental variables not found")

            else:
                address = settings["proxy_address", None]

                if not address:
                    raise virtool.errors.ProxyError("No proxy address set")

                if address:
                    username = settings["proxy_username", None]
                    password = settings["proxy_password", None]

                    if username and password:
                        auth = aiohttp.BasicAuth(username, password)

        return auth, address


@web.middleware
async def middleware(req, handler):
    try:
        return await handler(req)

    except virtool.errors.ProxyError as err:
        return json_response({
            "id": "proxy_error",
            "message": str(err)
        }, status=500)

    except aiohttp.ClientProxyConnectionError:
        return json_response({
            "id": "proxy_error",
            "message": "Could not connect to proxy"
        }, status=500)
