from __future__ import annotations

import typing

from aiohttp.web_request import Request

from virtool.types import App

if typing.TYPE_CHECKING:
    from virtool.data.layer import DataLayer


def get_data_from_app(app: App) -> DataLayer:
    """
    Get the application data layer object from the :class:``Application`` object.

    :param app: the application object
    :return: the application data layer
    """
    return app["data"]


def get_data_from_req(req: Request) -> DataLayer:
    """
    Get the application data layer object from a :class:``Request`` object.

    :param req: an aiohttp request
    :return: the application data layer
    """
    return get_data_from_app(req.app)
