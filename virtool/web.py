import logging
import virtool.routes
import virtool.sessions

from aiohttp import web
from motor import motor_asyncio

logger = logging.getLogger(__name__)


def create_app(loop, db_name="virtool"):
    app = web.Application(loop=loop, middlewares=[virtool.sessions.middleware_factory])

    app["db"] = motor_asyncio.AsyncIOMotorClient(io_loop=loop)[db_name]

    virtool.routes.setup_routes(app)

    return app
