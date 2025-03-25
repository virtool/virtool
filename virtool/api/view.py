"""An view for Virtool API endpoints.

Borrows Pydantic-based validation concepts from aiohttp_pydantic.
"""

import asyncio
from collections.abc import Generator
from functools import wraps
from logging import getLogger
from typing import Any, ClassVar, Never

from aiohttp.abc import AbstractView
from aiohttp.hdrs import METH_ALL
from aiohttp.typedefs import Handler
from aiohttp.web_exceptions import HTTPMethodNotAllowed
from aiohttp.web_response import StreamResponse
from pydantic import ValidationError

from virtool.api.client import AbstractClient
from virtool.api.errors import APIInvalidInput
from virtool.api.inject import (
    BodyInjector,
    HeadersInjector,
    InjectorUpdate,
    PathInjector,
    QueryStringInjector,
)
from virtool.api.introspect import HandlerIntrospection
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_req
from virtool.oas.utils import HandlerParameterContext

logger = getLogger("api")


class APIView(AbstractView):
    """A custom Aiohttp view for Virtool API endpoints.

    Functionality:

    * Validates requests and responses using Pydantic models. Strongly borrowed from
      aiohttp_pydantic.
    * Can be easily introspected to generate OpenAPI documentation.

    """

    allowed_methods: ClassVar[set[str]] = {}
    """Allowed HTTP methods.

    Overridden when subclassed.
    """

    job = list[str]
    """Routes to be registered for access by jobs only."""

    web = list[str]
    """Routes to be registered for public access."""

    async def _iter(self) -> StreamResponse:
        if (method_name := self.request.method) not in self.allowed_methods:
            raise HTTPMethodNotAllowed(self.request.method, self.allowed_methods)

        return await getattr(self, method_name.lower())()

    def __await__(self) -> Generator[Any, None, StreamResponse]:
        return self._iter().__await__()

    def __init_subclass__(cls, **kwargs: Any) -> None:
        """Define allowed methods and decorate handlers.

        Decorated handlers have their docstrings and annotations introspected and used
        to inject parameters into the handler.

        Handlers are decorated if and only if they directly bound on the APIView class
        or subclass. This prevents multiple decoration of the same method.
        """
        cls.allowed_methods = {
            meth_name for meth_name in METH_ALL if hasattr(cls, meth_name.lower())
        }

        for meth_name in (name.lower() for name in METH_ALL):
            try:
                handler = getattr(cls, meth_name)
            except AttributeError:
                continue

            setattr(cls, meth_name, _inject_params(handler))

    @property
    def client(self) -> AbstractClient:
        """The client associated with the request."""
        return self.request["client"]

    @property
    def data(self) -> DataLayer:
        """The application data layer object."""
        return get_data_from_req(self.request)

    @staticmethod
    async def on_validation_errors(
        exceptions: list[tuple[HandlerParameterContext, ValidationError]],
    ) -> Never:
        """Handle a validation error raised during parameter injection.

        This hook can be redefined to return a custom HTTP response error. The exception
        is a pydantic.ValidationError and the context is "body", "headers", "path" or
        "query string".

        :param context: the context where the exception was raised
        :param exceptions: the exceptions raised during parameter injection
        :raises APIInvalidInput: an exception with the errors encoded in JSON
        """
        errors = []

        for context, exception in exceptions:
            for error in exception.errors(include_url=False):
                print(error)
                if "ctx" in error and "error" in error["ctx"]:
                    message = str(error["ctx"]["error"])
                else:
                    logger.warning("Error context not found in Pydantic error")
                    message = ""

                if error["loc"]:
                    errors.extend(
                        [
                            {"field": field, "message": message, "in": context}
                            for field in error["loc"]
                        ],
                    )
                else:
                    errors.append({"field": "", "in": context, "message": message})

        raise APIInvalidInput(errors=errors)


def _inject_params(handler: Handler) -> Handler:
    """Decorate the passed handler so it is injected with parameters from the request.

    :param handler: the handler to decorate
    :return: the decorated handler
    """
    introspection = HandlerIntrospection(handler)

    injectors = [
        cls(introspection.parameters)
        for cls in (BodyInjector, HeadersInjector, PathInjector, QueryStringInjector)
    ]

    @wraps(handler)
    async def wrapped_handler(self: APIView) -> StreamResponse:
        updates: list[InjectorUpdate] = await asyncio.gather(
            *[injector.inject(self.request) for injector in injectors],
        )

        args = []
        kwargs = {}

        errors: list[tuple[HandlerParameterContext, ValidationError]] = []

        for update in updates:
            args.extend(update.args)
            errors.extend([(update.context, e) for e in update.errors])
            kwargs.update(update.kwargs)

        if errors:
            await self.on_validation_errors(errors)

        return await handler(self, *args, **kwargs)

    return wrapped_handler
