import os
import sys
from aiohttp import web
from mako.template import Template

from virtool.utils import get_static_hash


async def middleware_factory(app, handler):
    async def middleware_handler(request):
        is_api_call = request.path.startswith("/api")

        try:
            response = await handler(request)

            if not is_api_call:
                if response.status == 404:
                    return handle_404(app["client_path"])

            return response

        except web.HTTPException as ex:
            if not is_api_call and ex.status == 404:
                return handle_404(app["client_path"])

            raise

    return middleware_handler


def handle_404(client_path):
    path = os.path.join(sys.path[0], "templates", "error_404.html")
    html = Template(filename=path).render(hash=get_static_hash(client_path))
    return web.Response(body=html, content_type="text/html", status=404)
