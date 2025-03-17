"""Introspection for API views and handlers."""

import re
import typing
from collections import Counter, defaultdict
from collections.abc import Iterator
from dataclasses import dataclass
from enum import Enum
from inspect import getdoc, getmro, signature
from types import SimpleNamespace
from typing import Any, TypeVar, Union, get_type_hints

from aiohttp.typedefs import Handler
from pydantic import BaseModel, create_model

from virtool.api.status import StatusCode, is_status_coded
from virtool.oas.error import DocstringParsingError, DuplicateParameterNamesError
from virtool.oas.uploaded_file import UploadBody
from virtool.oas.utils import is_pydantic_base_model, robust_issubclass
from virtool.validation import Unset


class HandleParameterSource(Enum):
    """An enumeration of the possible sources for a handler parameter."""

    BODY = "body"
    """The parameter is set from the request body."""

    HEADER = "header"
    """The parameter is set from an HTTP header."""

    PATH = "path"
    """The parameter is set from the URL path."""

    QUERY = "query"
    """The parameter is set from the query string."""


@dataclass
class Docstring:
    """A class to extract extra OAS description from docstring."""

    description: str
    """The long form description for the endpoint."""

    title: str
    """A short title for the endpoint (eg. Get a user)."""

    status_codes: dict[int, str]
    """A dictionary of status codes and their descriptions."""

    @classmethod
    def from_string(cls: type, raw: str) -> "Docstring":
        """Create a Docstring object from a raw docstring.

        If the title spans more than the first line, an exception is raised.

        """
        lines = iter(raw.splitlines())

        title = next(lines).strip()

        if next((line.strip() for line in lines), None) != "":
            msg = "Expected empty line after title."
            raise DocstringParsingError(msg)

        first_description_line = next(lines, None)

        if first_description_line is None or first_description_line.strip() == "":
            msg = "Expected the endpoint description on the next line."
            raise DocstringParsingError(msg)

        description_lines = [first_description_line]

        status_codes = {}

        for line in lines:
            if "Status Codes" in line:
                status_codes = Docstring._parse_status_codes(lines)
                break

            description_lines.append(line.strip())

        while description_lines and description_lines[-1] == "":
            description_lines.pop()

        return cls(
            description="\n".join(description_lines),
            title=title,
            status_codes=status_codes,
        )

    @staticmethod
    def _parse_status_codes(lines: Iterator[str]) -> dict[StatusCode, str]:
        """Parse the status code block.

        This function is called after the "Status Codes:" line is found in the
        docstring. It returns a dictionary of status codes and their descriptions.

        :param lines: An iterator over lines in the docstring.
        :return: A dictionary of status codes and their descriptions.
        """
        status_codes = {}

        for line in lines:
            if re.search("^\\s*(\\d{3})\\s*:", line):
                raw_status_code, desc = line.split(":", 1)
                raw_status_code = raw_status_code.strip()

                try:
                    status_code = StatusCode(int(raw_status_code))
                except ValueError as err:
                    msg = f"Status code {raw_status_code} is invalid or not allowed."
                    raise DocstringParsingError(msg) from err

                status_codes[status_code] = desc.strip()
            else:
                break

        return status_codes


HandlerParameterType = TypeVar("HandlerParameterType")


@dataclass
class HandlerParameter:
    """A parameter for an API handler."""

    __slots__ = ["default", "name", "source", "type"]

    default: HandlerParameterType
    """The default value of the parameter."""

    name: str
    """The name of the parameter."""

    source: HandleParameterSource
    """The source of the parameter."""

    type: type[HandlerParameterType]
    """The type of the parameter."""

    @property
    def required(self) -> bool:
        """Whether the parameter is required."""
        return self.default is Unset


class HandlerParameterGroup(SimpleNamespace):
    """A group of header or query string parameters.

    The parameter from query string or header will be set in the group and the group
    will be passed as function parameter.

    Example:
    -------
    class Pagination(Group):
        current_page: int = 1
        page_size: int = 15

    class PetView(APIView):
        def get(self, page: Pagination):
            ...

    """

    @classmethod
    def as_parameters(
        cls: type,
        source: HandleParameterSource,
    ) -> dict[str, HandlerParameter]:
        """Return the properties of the group as a dictionary."""
        types = {}
        defaults = {}

        mro = getmro(cls)

        for base in reversed(mro[: mro.index(HandlerParameterGroup)]):
            attrs = vars(base)

            # Use __annotations__ to know if an attribute is overwritten to remove the
            # default value.
            for name in base.__annotations__:
                if (default := attrs.get(name, Unset)) is Unset:
                    defaults.pop(name, None)
                else:
                    defaults[name] = default

            # Use get_type_hints to have postponed annotations.
            for name, type_ in get_type_hints(base, include_extras=True).items():
                types[name] = type_

        return {
            name: HandlerParameter(
                default=defaults.get(name, Unset),
                name=name,
                source=source,
                type=types[name],
            )
            for name in types
        }


@dataclass
class HandlerParameters:
    """A collection of parameters for an API handler."""

    parameters: list[HandlerParameter]

    model_name_prefix: str = "Handler"
    """The prefix for the name of the model at `HandleParameters.model`.

    For example, if the prefix is "Query", the model will be named "QueryModel". By
    default the prefix is "Handler" and the model will be named "HandlerModel".
    """

    def __post_init__(self) -> None:
        """Raise an exception if duplicate parameter names are found."""
        names = [parameter.name for parameter in self.parameters]

        counter = Counter(names)

        if counter and counter.most_common(1)[0][1] > 1:
            raise DuplicateParameterNamesError(
                [name for name in names if names.count(name) > 1],
            )

    def __iter__(self) -> Iterator[HandlerParameter]:
        """Iterate over the parameters."""
        return iter(self.parameters)

    @classmethod
    def from_handler(cls: type, handler: Handler) -> "HandlerParameters":
        """Create a HandlerParameters object from a handler."""
        parameters: list[HandlerParameter] = []

        type_hints = get_type_hints(handler, include_extras=True)

        signature_parameters = signature(handler).parameters

        if not signature_parameters:
            msg = f"Handler {handler} has no parameters"
            raise RuntimeError(msg)

        if "self" not in signature_parameters:
            msg = f"Handler {handler} has no self parameter"
            raise RuntimeError(msg)

        for name, spec in signature_parameters.items():
            if name == "self":
                continue

            if spec.annotation == spec.empty:
                msg = f"The parameter {name} must have an annotation"
                raise RuntimeError(msg)

            default = Unset if spec.default is spec.empty else spec.default

            annotation = type_hints[name]

            if spec.kind is spec.POSITIONAL_ONLY:
                parameters.append(
                    HandlerParameter(
                        default=default,
                        name=name,
                        source=HandleParameterSource.PATH,
                        type=spec.annotation,
                    ),
                )

            elif spec.kind is spec.POSITIONAL_OR_KEYWORD:
                is_from_body = is_pydantic_base_model(annotation) or robust_issubclass(
                    annotation,
                    UploadBody,
                )

                parameters.append(
                    HandlerParameter(
                        default=default,
                        name=name,
                        source=HandleParameterSource.BODY
                        if is_from_body
                        else HandleParameterSource.QUERY,
                        type=spec.annotation,
                    ),
                )

            elif spec.kind is spec.KEYWORD_ONLY:
                parameters.append(
                    HandlerParameter(
                        default=default,
                        name=name,
                        source=HandleParameterSource.HEADER,
                        type=spec.annotation,
                    ),
                )

            else:
                msg = f"You cannot use {spec.VAR_POSITIONAL} parameters"
                raise RuntimeError(msg)

        return cls(parameters)

    @property
    def body(self) -> HandlerParameter | None:
        """The parameter that is set from the request body."""
        for parameter in self.parameters:
            if parameter.source is HandleParameterSource.BODY:
                return parameter

        return None

    @property
    def body_is_upload(self) -> bool:
        """Whether the request body is a multipart upload."""
        return robust_issubclass(self.body.type, UploadBody)

    @property
    def groups(self) -> dict[str, HandlerParameterGroup]:
        """The groups of parameters."""
        groups = {}

        for parameter in self.parameters:
            if robust_issubclass(parameter.type, HandlerParameterGroup):
                groups[parameter.name] = parameter.type.as_parameters()

        return groups

    @property
    def headers(self) -> "HandlerParameters":
        """Parameters that are set from the HTTP headers."""
        return HandlerParameters(
            [
                parameter
                for parameter in self.parameters
                if parameter.source is HandleParameterSource.HEADER
            ],
            "Headers",
        )

    @property
    def path(self) -> "HandlerParameters":
        """Parameters that are set from the URL path."""
        return HandlerParameters(
            [
                parameter
                for parameter in self.parameters
                if parameter.source is HandleParameterSource.PATH
            ],
            "Path",
        )

    @property
    def query(self) -> "HandlerParameters":
        """Parameters that are set from the query string."""
        return HandlerParameters(
            [
                parameter
                for parameter in self.parameters
                if parameter.source is HandleParameterSource.QUERY
            ],
            "Query",
        )

    @property
    def model(self) -> type[BaseModel]:
        """A Pydantic model that can be used for validating parameter values."""
        spec = {}

        for parameter in self.unpacked:
            if parameter.default is Unset:
                spec[parameter.name] = (parameter.type, ...)
            else:
                spec[parameter.name] = (parameter.type, parameter.default)

        return create_model("HandlerModel", **spec)

    @property
    def unpacked(self) -> list[HandlerParameter]:
        """A list of the handler parameters with groups unpacked."""
        unpacked = []

        for parameter in self.parameters:
            if robust_issubclass(parameter.type, HandlerParameterGroup):
                unpacked += parse_group_parameters(
                    parameter.type,
                    parameter.source,
                )
            else:
                unpacked.append(parameter)

        return unpacked


class HandlerReturnValue:
    def __init__(self, handler: Handler) -> None:
        return_type = get_type_hints(handler).get("return")

        if return_type is None:
            msg = f"Missing return type annotation for {handler}"
            raise ValueError(msg)

        self.responses = defaultdict(dict)
        self.component_schemas = {}
        self.type = return_type

        self._handle_union(self.type)

    def _handle_list(self, obj: Any) -> dict:
        if typing.get_origin(obj) is list:
            return {
                "type": "array",
                "items": self._handle_pydantic_base_model(typing.get_args(obj)[0]),
            }

        return self._handle_pydantic_base_model(obj)

    def _handle_pydantic_base_model(self, obj: Any) -> None:
        """Handle a Pydantic BaseModel."""
        if is_pydantic_base_model(obj):
            schema = obj.model_json_schema(
                ref_template="#/components/schemas/{model}",
            ).copy()

            if defs := schema.pop("$defs", None):
                self.component_schemas.update(defs)

            return schema

        return {}

    def _handle_status_code_type(self, obj) -> None:
        if is_status_coded(typing.get_origin(obj)):
            status_code = typing.get_origin(obj).__name__[1:]
            self.responses[status_code]["content"] = {
                "application/json": {
                    "schema": self._handle_list(typing.get_args(obj)[0]),
                },
            }

        elif is_status_coded(obj):
            status_code = obj.__name__[1:]
            self.responses[status_code]["content"] = {}

    def _handle_union(self, obj: Any) -> None:
        """Handle a union of response types (eg. R200 | R404)."""
        if typing.get_origin(obj) is Union:
            for arg in typing.get_args(obj):
                self._handle_status_code_type(arg)

        self._handle_status_code_type(obj)


class HandlerIntrospection:
    """Introspection data for an API handler.

    This information is used to:

    1. Parse and inject parameters into the handler from incoming requests.
    2. Generate OpenAPI documentation.

    """

    def __init__(self, handler: Handler) -> None:
        self.handler = handler
        """The handler the introspection data is for."""

        doc = getdoc(handler)

        if doc is None:
            raise ValueError(f"Handler {handler} has no docstring")

        self.docstring = Docstring.from_string(doc)
        """The parsed docstring for the handler."""

        self.parameters = HandlerParameters.from_handler(handler)
        """The parameters for the handler."""

        self.return_value = HandlerReturnValue(handler)
        """Information about the return value for the handler."""


def parse_group_parameters(
    cls: type[HandlerParameterGroup],
    source: HandleParameterSource,
) -> list[HandlerParameter]:
    """Analyse Group subclass annotations and return them with default values."""
    types = {}
    defaults = {}

    mro = getmro(cls)

    for base in reversed(mro[: mro.index(HandlerParameterGroup)]):
        attrs = vars(base)

        # Use __annotations__ to know if an attribute is overwritten to remove the
        # default value.
        for name in base.__annotations__:
            if (default := attrs.get(name, Unset)) is Unset:
                defaults.pop(name, None)
            else:
                defaults[name] = default

        # Use get_type_hints to have postponed annotations.
        for name, type_ in get_type_hints(base, include_extras=True).items():
            types[name] = type_

    return [
        HandlerParameter(
            default=defaults.get(name, Unset),
            name=name,
            source=source,
            type=types[name],
        )
        for name in types
    ]


def _unpack_group_in_signature(args: dict, defaults: dict) -> None:
    """Unpack in place each Group found in args."""
    for group_name, group in args.copy().items():
        if robust_issubclass(group, HandlerParameterGroup):
            group_sig, group_default = parse_group_parameters(group)

            for attr_name in group_sig:
                if attr_name in args and attr_name != group_name:
                    raise DuplicateParameterNamesError(attr_name, group)

            del args[group_name]
            args.update(group_sig)
            defaults.update(group_default)
