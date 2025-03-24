"""Injectors inject parsed HTTP request parameters in :class:`APIView`."""

import abc
from abc import ABCMeta
from collections.abc import Collection
from dataclasses import dataclass, field
from json.decoder import JSONDecodeError
from typing import get_origin

from aiohttp import ContentTypeError
from aiohttp.helpers import parse_mimetype
from aiohttp.web_request import BaseRequest, Request
from pydantic import BaseModel, create_model

from virtool.api.errors import APIBadRequest
from virtool.api.introspect import (
    HandlerParameters,
)
from virtool.oas.uploaded_file import UploadBody
from virtool.oas.utils import HandlerParameterContext, robust_issubclass
from virtool.uploads.utils import body_part_file_chunker
from virtool.validation import Unset


@dataclass
class InjectorUpdate:
    """Values that should be injected into an APIView method."""

    context: HandlerParameterContext
    """The context of the parameters being injected."""

    args: Collection = field(default_factory=list)
    """Positional arguments to inject."""

    kwargs: dict = field(default_factory=dict)
    """Keyword arguments to inject."""

    errors: list[Exception] = field(default_factory=list)
    """Exceptions that occurred during injection."""


class AbstractInjector(metaclass=ABCMeta):
    """An injector parses an HTTP request and injects its params to the view."""

    model: type[BaseModel]
    """The pydantic model used to validate the request."""

    @abc.abstractmethod
    def __init__(self, args_spec: dict, default_values: dict) -> None:
        """Initialise the injector with the expected fields and their default values.

        The argument spec is a dictionary with the name of the field as key and the type
        as value.
        """

    @abc.abstractmethod
    async def inject(self, request: Request) -> InjectorUpdate:
        """Get the parameters and inject them intp args_view or kwargs_view."""


class PathInjector(AbstractInjector):
    """Validates, and injects the part of path inside the view positional args."""

    def __init__(self, parameters: HandlerParameters) -> None:
        self.parameters = parameters.path

    async def inject(self, request: Request) -> InjectorUpdate:
        """Parse the path parameters and inject them in the view."""
        validated = list(
            self.parameters.model.model_validate(request.match_info)
            .model_dump()
            .values(),
        )

        return InjectorUpdate(HandlerParameterContext.BODY, args=validated)


class BodyInjector(AbstractInjector):
    """Validates and injects the content of request body inside the view kwargs."""

    def __init__(self, parameters: HandlerParameters) -> None:
        self.parameter = parameters.body

        if self.parameter and not robust_issubclass(
            self.parameter.type,
            BaseModel | UploadBody,
        ):
            msg = (
                f"Unsupported body parameter type: {self.parameter.type}. Body "
                "parameters must be of type BaseModel or UploadBody."
            )
            raise ValueError(msg)

    async def inject(self, request: BaseRequest) -> InjectorUpdate:
        """Parse and validate the request body and inject it in the view kwargs."""
        injectable = InjectorUpdate(HandlerParameterContext.BODY)

        if self.parameter is None:
            return injectable

        if robust_issubclass(self.parameter.type, UploadBody):
            if parse_mimetype(request.content_type).type != "multipart":
                raise APIBadRequest(message="Multipart request is required") from None

            multipart_reader = await request.multipart()

            part = await multipart_reader.next()

            if part is None:
                raise APIBadRequest(
                    message="No part found in the multipart request",
                ) from None

            injectable.kwargs[self.parameter.name] = body_part_file_chunker(part)

            return injectable

        if robust_issubclass(self.parameter.type, BaseModel):
            try:
                body = await request.json()
            except ContentTypeError:
                raise APIBadRequest(
                    message="Content-Type must be application/json",
                ) from None
            except JSONDecodeError:
                raise APIBadRequest(message="Malformed JSON") from None

            model = self.parameter.type

            # Pydantic tries to cast certain structures, such as a list of 2-tuples,
            # to a dict. Prevent this by requiring the body to be a dict for object
            # models.
            if (
                not isinstance(body, dict)
                and model.model_json_schema().get(
                    "type",
                )
                == "object"
            ):
                raise APIBadRequest(message="Body must be a JSON object") from None

            injectable.kwargs[self.parameter.name] = model.model_validate(
                body,
            )

        return injectable


class QueryStringInjector(AbstractInjector):
    """Validates and injects the query string inside the view kwargs."""

    def __init__(self, parameters: HandlerParameters) -> None:
        self.parameters = parameters.query

        self._multi_valued_parameters = {
            parameter.name
            for parameter in self.parameters
            if get_origin(parameter.type) is list
        }
        """Names of parameters that can take multiple values in the query string.

        These are typed as lists in the handler signature.
        """

        fields = {}

        for parameter in self.parameters:
            if parameter.default is not Unset:
                fields[parameter.name] = (parameter.type, parameter.default)
            else:
                fields[parameter.name] = (parameter.type, ...)

        self.model = create_model("QueryStringModel", **fields)

    async def inject(self, request: BaseRequest) -> InjectorUpdate:
        validated = self.model.model_validate(
            {
                key: (
                    values
                    if len(values := request.query.getall(key)) > 1
                    or key in self._multi_valued_parameters
                    else value
                )
                for key, value in request.query.items()
            },
        ).model_dump()

        for group_parameter in self.parameters.groups.values():
            group = group_parameter.type()

            for attr_name in group_parameter.parameters:
                setattr(group, attr_name, validated.pop(attr_name))

            validated[group.name] = group

        return InjectorUpdate(HandlerParameterContext.QUERY, kwargs=validated)


class HeadersInjector(AbstractInjector):
    """Validates and injects the HTTP headers inside the view kwargs."""

    def __init__(self, parameters: HandlerParameters) -> None:
        self.parameters = parameters.headers

    async def inject(self, request: BaseRequest) -> InjectorUpdate:
        validated = self.parameters.model.model_validate(
            {
                name.lower().replace("-", "_"): value
                for name, value in request.headers.items()
            },
        ).model_dump()

        for group_parameter in self.parameters.groups.values():
            group = group_parameter.type()

            for parameter in group_parameter.parameters:
                setattr(group, parameter.name, validated.pop(parameter.name))

            validated[group_parameter.name] = group

        return InjectorUpdate(HandlerParameterContext.HEADERS, kwargs=validated)
