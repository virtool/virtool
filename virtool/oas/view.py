import typing
from inspect import getdoc
from itertools import count
from typing import get_type_hints

from aiohttp.web_app import Application
from aiohttp_pydantic.injectors import _parse_func_signature
from aiohttp_pydantic.oas import docstring_parser
from aiohttp_pydantic.oas.struct import OpenApiSpec3, OperationObject, PathItem
from aiohttp_pydantic.oas.typing import is_status_code_type
from aiohttp_pydantic.utils import is_pydantic_base_model
from aiohttp_pydantic.view import PydanticView, is_pydantic_view
from pydantic import BaseModel


class _OASResponseBuilder:
    """Parse the type annotated as returned by a function and
    generate the OAS operation response.
    """

    def __init__(self, oas: OpenApiSpec3, oas_operation, status_code_descriptions):
        self._oas_operation = oas_operation
        self._oas = oas
        self._status_code_descriptions = status_code_descriptions

    def _handle_pydantic_base_model(self, obj):
        if is_pydantic_base_model(obj):
            response_schema = obj.schema(
                ref_template="#/components/schemas/{model}"
            ).copy()
            if def_sub_schemas := response_schema.pop("definitions", None):
                self._oas.components.schemas.update(def_sub_schemas)
            return response_schema
        return {}

    def _handle_list(self, obj):
        if typing.get_origin(obj) is list:
            return {
                "type": "array",
                "items": self._handle_pydantic_base_model(typing.get_args(obj)[0]),
            }
        return self._handle_pydantic_base_model(obj)

    def _handle_status_code_type(self, obj, *args):
        print(f"Handling status code type: {obj}")
        if is_status_code_type(typing.get_origin(obj)):
            status_code = typing.get_origin(obj).__name__[1:]
            schema = self._handle_list(typing.get_args(obj)[0])

            self._oas_operation.responses[status_code].content = {
                "application/json": {"schema": schema}
            }

            if desc := self._status_code_descriptions.get(int(status_code)):
                self._oas_operation.responses[status_code].description = desc

        elif is_status_code_type(obj):
            status_code = obj.__name__[1:]
            self._oas_operation.responses[status_code].content = {}
            desc = self._status_code_descriptions.get(int(status_code))
            if desc:
                self._oas_operation.responses[status_code].description = desc

    def _handle_union(self, obj, *args):
        if typing.get_origin(obj) is typing.Union:
            for arg in typing.get_args(obj):
                self._handle_status_code_type(arg, *args)
        self._handle_status_code_type(obj, *args)

    def build(self, obj, *args):
        self._handle_union(obj, *args)


def _add_http_method_to_oas(
    oas: OpenApiSpec3, oas_path: PathItem, http_method: str, view: type[PydanticView]
):
    http_method = http_method.lower()
    oas_operation: OperationObject = getattr(oas_path, http_method)
    handler = getattr(view, http_method)
    path_args, body_args, qs_args, header_args, defaults = _parse_func_signature(
        handler, unpack_group=True
    )
    description = getdoc(handler)
    if description:
        oas_operation.description = docstring_parser.operation(description)
        oas_operation.tags = docstring_parser.tags(description)
        status_code_descriptions = docstring_parser.status_code(description)
    else:
        status_code_descriptions = {}

    request = None

    if body_args:
        body_schema = (
            next(iter(body_args.values()))
            .schema(ref_template="#/components/schemas/{model}")
            .copy()
        )
        if def_sub_schemas := body_schema.pop("definitions", None):
            oas.components.schemas.update(def_sub_schemas)

        try:
            request = body_schema["example"]
        except KeyError:
            pass

        oas_operation.request_body.content = {
            "application/json": {"schema": body_schema}
        }

    indexes = count()
    for args_location, args in (
        ("path", path_args.items()),
        ("query", qs_args.items()),
        ("header", header_args.items()),
    ):
        for name, type_ in args:
            i = next(indexes)
            oas_operation.parameters[i].in_ = args_location
            oas_operation.parameters[i].name = name

            attrs = {"__annotations__": {"__root__": type_}}
            if name in defaults:
                attrs["__root__"] = defaults[name]
                oas_operation.parameters[i].required = False
            else:
                oas_operation.parameters[i].required = True

            oas_operation.parameters[i].schema = type(name, (BaseModel,), attrs).schema(
                ref_template="#/components/schemas/{model}"
            )

    return_type = get_type_hints(handler).get("return")
    if return_type is not None:
        if request:
            _OASResponseBuilder(oas, oas_operation, status_code_descriptions).build(
                return_type, request
            )
        else:
            _OASResponseBuilder(oas, oas_operation, status_code_descriptions).build(
                return_type
            )


def generate_oas(
    app: Application,
    version_spec: str | None = None,
    title_spec: str | None = None,
) -> dict:
    """Generate and return Open Api Specification from PydanticView in application."""
    oas = OpenApiSpec3()

    if version_spec is not None:
        oas.info.version = version_spec

    if title_spec is not None:
        oas.info.title = title_spec

    for resources in app.router.resources():
        for resource_route in resources:
            if not is_pydantic_view(resource_route.handler):
                continue

            view: type[PydanticView] = resource_route.handler
            info = resource_route.get_info()
            path = oas.paths[info.get("path", info.get("formatter"))]
            if resource_route.method == "*":
                for method_name in view.allowed_methods:
                    _add_http_method_to_oas(oas, path, method_name, view)
            else:
                _add_http_method_to_oas(oas, path, resource_route.method, view)

    return oas.spec
