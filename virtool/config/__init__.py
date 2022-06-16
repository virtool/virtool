from aiohttp.web_request import Request

from virtool.config.cls import Config
from virtool.types import App


def get_config_from_app(app: App) -> Config:
    """Get the application configuration object given the ``app`` object."""
    return app["config"]


def get_config_from_req(req: Request) -> Config:
    """Get the application configuration object given a request."""
    return get_config_from_app(req.app)
