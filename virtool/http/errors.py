import os
import sys

from aiohttp import web
from mako.template import Template

import virtool.utils
from virtool.api.utils import not_found


@web.middleware
async def middleware(req, handler):
    is_api_call = req.path.startswith("/api")

    try:
        response = await handler(req)

        if not is_api_call and response.status == 404:
            return handle_404(req.app["client_path"])

        return response

    except web.HTTPException as ex:
        if is_api_call:
            return not_found()

        if ex.status == 404:
            return handle_404(req.app["client_path"])

        raise


def handle_404(client_path):
    path = os.path.join(sys.path[0], "templates", "error_404.html")

    try:
        html = Template(filename=path).render(hash=virtool.utils.get_static_hash(client_path))
    except FileNotFoundError:
        with open(os.path.join(sys.path[0], "templates/client_path_error.html"), "r") as handle:
            return web.Response(body=handle.read(), content_type="text/html")

    return web.Response(body=html, content_type="text/html", status=404)
