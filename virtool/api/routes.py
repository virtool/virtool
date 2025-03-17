from collections.abc import Callable
from enum import Enum

from aiohttp.abc import AbstractView
from aiohttp.typedefs import Handler
from aiohttp.web_routedef import RouteTableDef

from virtool.api.view import APIView

_HandlerType = type[AbstractView] | Handler
_Deco = Callable[[_HandlerType], _HandlerType]


class RouteMode(Enum):
    JOB = "job"
    WEB = "web"


class Routes(RouteTableDef):
    def __init__(self):
        super().__init__()

        self.job_table = RouteTableDef()
        self.web_table = RouteTableDef()

        self.job = self.job_table.view
        """Routes to be registered for access by jobs only."""

        self.web = self.web_table.view
        """Routes to be registered for public access."""

    def both(self, path: str, view: APIView) -> _Deco:
        """Register a view for access by both jobs and web."""
        view.modes = ("job", "web")
        return self._table.view(path)(view)


class Routes(RouteTableDef):
    def __init__(self):
        super().__init__()

        self.web = RouteTableDef()
        """Routes to be registered for public access."""

        self.job = RouteTableDef()
        """Routes to be registered for access by jobs only."""
