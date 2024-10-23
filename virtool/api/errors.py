"""Definitions for raising and handling API errors.

Subclasses of `APIException` raised during request handling are converted into
consistently structured JSON responses by the `error_middleware` middleware.
"""

from collections.abc import Callable
from typing import Never

from aiohttp.web import HTTPException, Request, Response, middleware

from virtool.api.custom_json import json_response


class APIException(HTTPException):
    """Base class for all API errors."""

    def __init__(self, id: str, message: str, status_code: int):
        self.id = id
        self.message = message
        self.status_code = status_code


class APINoContent(APIException):
    """Exception raised when an API request has no content."""

    def __init__(self, message: str = "No content"):
        super().__init__("no_content", message, status_code=204)


class APIBadRequest(APIException):
    """Exception raised when an API request is malformed."""

    def __init__(self, message: str = "Bad request"):
        super().__init__("bad_request", message, status_code=400)


class APIUnauthorized(APIException):
    """Exception raised when an API request is unauthorized."""

    def __init__(self, message: str = "Unauthorized", error_id: str = "unauthorized"):
        super().__init__(error_id, message, status_code=401)

    @staticmethod
    def raise_invalid_authorization_header() -> Never:
        raise APIUnauthorized(
            "Invalid authorization header",
            error_id="invalid_authorization_header",
        )


class APINotFound(APIException):
    """Exception raised when an API resource is not found."""

    def __init__(self, message: str = "Not found"):
        super().__init__("not_found", message, status_code=404)


class APIForbidden(APIException):
    """Exception raised when an API request is forbidden."""

    def __init__(self, message: str = "Forbidden", error_id: str = "forbidden"):
        super().__init__(error_id, message, status_code=403)


class APIInsufficientRights(APIForbidden):
    """Exception raised when an API request is forbidden."""

    def __init__(self, message: str = "Insufficient rights"):
        super().__init__(message, "insufficient_rights")


class APIConflict(APIException):
    """Exception raised when an API request conflicts with the current state."""

    def __init__(self, message: str = "Conflict", error_id: str = "conflict"):
        super().__init__(error_id, message, status_code=409)


class APIUnprocessableEntity(APIException):
    """Raising this exception during request handling immediately returns a
    `422` (Unprocessable Entity) response to the client.
    """

    def __init__(
        self,
        message: str = "Unprocessable entity",
        error_id: str = "unprocessable_entity",
        errors: dict = None,
    ):
        super().__init__(error_id, message, status_code=422)
        self.errors = errors


class APIInvalidQuery(APIUnprocessableEntity):
    """Raising this exception during request handling immediately returns a
    `422` (Invalid Query) response to the client.
    """

    def __init__(self, errors: dict):
        super().__init__(
            "Invalid query",
            error_id="invalid_query",
            errors=errors,
        )


class APIInvalidInput(APIUnprocessableEntity):
    """Raising this exception during request handling immediately returns a
    `422` (Invalid Input) response to the client.
    """

    def __init__(self, errors: dict):
        super().__init__(
            "Invalid input",
            error_id="invalid_input",
            errors=errors,
        )


class APIBadGateway(APIException):
    """Raising this exception during request handling immediately returns a
    `502` (Bad Gateway) response to the client.
    """

    def __init__(self, message: str = "Bad gateway", error_id: str = "bad_gateway"):
        super().__init__(error_id, message, status_code=502)


@middleware
async def error_middleware(req: Request, handler: Callable):
    """Middleware for converting HTTP exceptions into HTTP responses.

    Catches any `HTTPException` raised during request handling and returns a response
    with the appropriate status code and JSON body.

    :param req: the incoming request
    :param handler: the next middleware to be executed
    """
    try:
        return await handler(req)
    except APIException as err:
        if isinstance(err, APINoContent):
            return Response(
                status=err.status_code,
                headers={
                    "Content-Type": "application/json",
                },
            )

        body = {
            "id": err.id,
            "message": err.message,
        }

        if isinstance(err, (APIInvalidInput, APIInvalidQuery)):
            body["errors"] = err.errors

        return json_response(
            body,
            status=err.status_code,
        )
