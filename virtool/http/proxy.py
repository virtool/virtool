import ssl

import aiohttp
import certifi
from aiohttp import web

import virtool.errors
from virtool.api.response import json_response


class ProxyRequest:

    def __init__(self, settings, method, url, **kwargs):
        self.proxy = settings["proxy"] or None
        self.method = method
        self.url = url
        self.resp = None
        self._kwargs = kwargs
        self.ssl_context = ssl.create_default_context(cafile=certifi.where())

    async def __aenter__(self):
        try:
            self.resp = await self.method(
                self.url,
                proxy=self.proxy,
                ssl=self.ssl_context,
                **self._kwargs
            )
        except aiohttp.ClientHttpProxyError as err:
            if err.status == 407:
                raise virtool.errors.ProxyError("Proxy authentication required")

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

    except aiohttp.ClientProxyConnectionError:
        return json_response({
            "id": "proxy_error",
            "message": "Could not connect to proxy"
        }, status=500)
