from logging import getLogger

import aiohttp
import virtool.errors
from aiohttp import web
from virtool.api.response import json_response
from virtool.config.cls import Config

logger = getLogger(__name__)


class ProxyRequest:

    def __init__(self, config: Config, method, url, **kwargs):
        self.proxy = config.proxy or None
        self.method = method
        self.url = url
        self.resp = None
        self._kwargs = kwargs

    async def __aenter__(self):
        try:
            self.resp = await self.method(self.url, proxy=self.proxy, **self._kwargs)
        except aiohttp.ClientHttpProxyError as err:
            if err.status == 407:
                raise virtool.errors.ProxyError("Proxy authentication required")

        if self.resp.status == 407:
            raise virtool.errors.ProxyError("Proxy authentication failed")

        if self.resp.status >= 400:
            logger.warning(
                f"Error while making request to {self.resp.url}. {self.resp.status} - {await self.resp.text()}"
            )

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
