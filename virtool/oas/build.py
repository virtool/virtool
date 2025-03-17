from aiohttp.web_urldispatcher import UrlDispatcher
from pydantic import BaseModel

from virtool.api.introspect import HandlerIntrospection
from virtool.api.status import StatusCode
from virtool.api.view import APIView
from virtool.oas.cls import (
    OAS3,
    OASComponents,
    OASInfo,
    OASOperation,
    OASParameter,
    OASPath,
)
from virtool.oas.utils import (
    HandlerParameterContext,
    robust_issubclass,
)
from virtool.routes import setup_routes_on_router
from virtool.validation import Unset

_APP_KEY_NOT_SET = object()


def is_api_view(obj: type) -> bool:
    """Return True if obj is an APIView subclass else False."""
    try:
        return issubclass(obj, APIView)
    except TypeError:
        return False


def create_operation_from_handler(handler) -> tuple[OASOperation, dict]:
    http_method = handler.__name__

    introspection = HandlerIntrospection(handler)

    parameters = []

    if introspection.return_value.type is None:
        raise ValueError(f"Handler {handler} must have a return type.")

    component_schemas = {**introspection.return_value.component_schemas}

    for parameter in introspection.parameters:
        if parameter.source == HandlerParameterContext.BODY.value:
            continue

        oas_parameter = {
            "description": "",
            "in": parameter.source.value,
            "name": parameter.name,
            "required": True,
        }

        if parameter.default is not Unset:
            oas_parameter.update({"default": parameter.default, "required": False})

        if robust_issubclass(parameter.type, BaseModel):
            parameter_schema = parameter.type.model_json_schema(
                ref_template="#/components/schemas/{model}",
            )

            oas_parameter["schema"] = parameter_schema

            if def_sub_schemas := parameter_schema.pop("$defs", None):
                component_schemas.update(def_sub_schemas)

        parameters.append(OASParameter.model_validate(oas_parameter))

    responses: dict[StatusCode, dict] = {}

    for code, response in introspection.return_value.responses.items():
        status_code = StatusCode(int(code))

        if desc := introspection.docstring.status_codes.get(code):
            responses[status_code] = {**response, "description": desc}
        else:
            responses[status_code] = {**response, "description": ""}

    return (
        OASOperation(
            description=introspection.docstring.description,
            parameters=parameters,
            request_body=None,
            responses=responses,
            summary=introspection.docstring.title,
        ),
        component_schemas,
    )


#
# def _add_http_method_to_oas(
#     oas: OpenApiSpec3,
#     oas_path: OASPath,
#     handler: Handler,
#     http_method: str,
# ):
#     """Add an HTTP method to an OAS path."""
#     operation: OASOperation = getattr(oas_path, http_method)
#
#     if introspection.parameters.body_is_upload:
#         properties = {}
#
#         for parameter in introspection.parameters.body:
#             if robust_issubclass(parameter.type, UploadBody):
#                 properties[parameter.name] = {"type": "string", "format": "binary"}
#
#             else:
#                 body_schema = parameter.type.model_json_schema(
#                     ref_template="#/components/schemas/{model}",
#                 ).copy()
#
#                 properties[parameter.name] = body_schema
#
#                 if def_sub_schemas := body_schema.pop("$defs", None):
#                     oas.components.schemas.update(def_sub_schemas)
#
#         operation.request_body.content = {
#             "multipart/form-data": {
#                 "schema": {
#                     "type": "object",
#                     "properties": properties,
#                 },
#             },
#         }
#
#     elif introspection.parameters.body:
#         body_schema = introspection.parameters.body.type.model_json_schema(
#             ref_template="#/components/schemas/{model}",
#         ).copy()
#
#         if def_sub_schemas := body_schema.pop("$defs", None):
#             oas.components.schemas.update(def_sub_schemas)
#
#         operation.request_body.content = {
#             "application/json": {"schema": body_schema},
#         }
#
#     parameters = []
#
#     if introspection.return_value.type is None:
#         raise ValueError(f"Handler {handler} must have a return type.")
#
#     for parameter in introspection.parameters:
#         oas_parameter = {}
#
#         if parameter.source == HandlerParameterContext.BODY.value:
#             continue
#
#         if parameter.default is not NotSet:
#             oas_parameter["default"] = parameter.default
#
#         oas_parameter["in"] = parameter.source.value
#         oas_parameter["name"] = parameter.name
#         oas_parameter["required"] = parameter.required
#
#         parameter_schema = parameter.type.model_json_schema(
#             ref_template="#/components/schemas/{model}",
#         )
#
#         oas_parameter["schema"] = parameter_schema
#
#         if def_sub_schemas := parameter_schema.pop("$defs", None):
#             oas.components.schemas.update(def_sub_schemas)
#
#         parameters.append(oas_parameter)
#
#     endpoint_response = OASEndpointResponse(introspection.return_value.type)
#
#     for status_code, response in endpoint_response.responses.items():
#         if desc := introspection.docstring.status_code_descriptions.get(status_code):
#             response.responses[status_code].description = desc
#
#         operation.responses[status_code] = response


def generate_oas() -> OAS3:
    """Generate and return OpenAPI Specification from APIView in application."""
    router = UrlDispatcher()

    setup_routes_on_router(router)

    oas_info = OASInfo(description="", title="Virtool", version="0.0.1")

    oas_components = OASComponents(
        schemas={},
        security_schemes={"BasicAuth": {"type": "http", "scheme": "basic"}},
    )

    oas = OAS3(
        components=oas_components,
        info=oas_info,
        openapi="3.0.0",
        paths={},
        servers=[{"url": "/"}],
    )

    for resources in router.resources():
        for resource_route in resources:
            if not is_api_view(resource_route.handler):
                msg = f"Handler {resource_route.handler} is not an APIView."
                raise ValueError(msg)

            view: type[APIView] = resource_route.handler

            # Document all methods if we are routing to the whole view. Otherwise, just
            # document the routed method.
            if resource_route.method == "*":
                method_names = [method.lower() for method in view.allowed_methods]
            else:
                method_names = [resource_route.method.lower()]

            info = resource_route.get_info()
            path = info.get("path", info.get("formatter"))

            for method_name in method_names:
                try:
                    method = getattr(view, method_name)
                except AttributeError:
                    continue

                operation, component_schemas = create_operation_from_handler(method)

                oas_components.schemas.update(component_schemas)

                try:
                    oas_path = oas.paths[path]
                except KeyError:
                    oas_path = OASPath()
                    oas.paths[path] = oas_path

                setattr(oas.paths[path], method_name.lower(), operation)

    for schema in oas.components.schemas.values():
        for property_ in schema.get("properties", {}).values():
            nullable = False

            any_ofs = property_.get("anyOf")

            if any_ofs is None:
                continue

            new_any_ofs = []

            for any_of in any_ofs:
                if any_of.get("type") == "null":
                    nullable = True
                else:
                    new_any_ofs.append(any_of)

            property_["anyOf"] = new_any_ofs

            if nullable:
                property_["nullable"] = True

    for path in oas.paths.values():
        print(path)
        for operation in path.operations:
            print(operation)

    return oas
