import json.decoder
from functools import wraps

import aiohttp.web
import cerberus

from virtool.api.response import InvalidInput
from virtool.types import RouteHandler


def schema(schema_dict: dict):
    """
    Validate that the json body of the request matches the given cerberus schema.

    The validated json body will be available by `request["data"]`.

    :param schema_dict: The cerberus validation schema.
    :return: A decorator which wraps a :class:`RouteHandler`, ensuring that the JSON body
        of the request matches the cerberus schema.
    """
    validator = cerberus.Validator(schema_dict, purge_unknown=True)

    def _validate_schema_against_json_body(handler: RouteHandler):
        @wraps(handler)
        async def _wrap_handler(request: aiohttp.web.Request):
            try:
                data = await request.json()
            except (json.decoder.JSONDecodeError, UnicodeDecodeError):
                data = {}

            request["data"] = validator.validated(data)
            if not request["data"]:
                if "email" in validator.errors:
                    raise InvalidInput({data["email"]: ["Not a valid email"]})
                raise InvalidInput(validator.errors)

            return await handler(request)

        return _wrap_handler

    return _validate_schema_against_json_body
