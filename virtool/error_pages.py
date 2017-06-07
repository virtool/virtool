from aiohttp import web
from mako.template import Template

from virtool.utils import get_static_hash


template_500 = Template(filename="virtool/templates/error_500.html")


async def middleware_factory(app, handler):
    async def middleware_handler(request):
        try:
            response = await handler(request)

            if not request.path.startswith("/api"):
                if response.status == 404:
                    return handle_404()

            return response

        except web.HTTPException as ex:
            if ex.status == 404:
                return handle_404()

            raise

    return middleware_handler


def handle_404():
    html = Template(filename="virtool/templates/error_404.html").render(hash=get_static_hash())
    return web.Response(body=html, content_type="text/html")
