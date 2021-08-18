from typing import Callable

from aiohttp import web

from virtool.api.response import json_response, InvalidQuery
from virtool.templates import setup_template_env
from virtool.utils import get_static_hash


@web.middleware
async def middleware(req: web.Request, handler: Callable):
    try:
        resp = await handler(req)
        return resp

    except web.HTTPException as ex:
        if not req.path.startswith("/api") and ex.status == 404:
            return handle_404(req)
        data = {
            "id": "_".join(ex.reason.lower().split(" ")),
            "message": ex.text
        }
        if type(ex) == InvalidQuery:
            data["errors"] = ex.errors

        return json_response(data, ex.status)


def handle_404(req: web.Request):
    template = setup_template_env.get_template("error_404.html")

    static_hash = get_static_hash(req)

    html = template.render(hash=static_hash)

    return web.Response(body=html, content_type="text/html", status=404)
