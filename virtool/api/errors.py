"""Definitions for raising and handling API errors.

Subclasses of `APIException` raised during request handling are converted into
consistently structured JSON responses by the `error_middleware` middleware.
"""

from collections.abc import Callable
from typing import Never

from aiohttp.web import HTTPException, Request, Response, middleware
from aiohttp.web_response import StreamResponse
from typing_extensions import deprecated

from virtool.api.custom_json import json_response


class APIException(HTTPException):
    """Base class for all API errors."""

    def __init__(self, error_id: str, message: str, status_code: int) -> None:
        self.id = error_id
        self.message = message
        self.status_code = status_code


class APINoContent(APIException):
    """Exception raised when an API request has no content."""

    def __init__(self, message: str = "No content") -> None:
        super().__init__("no_content", message, status_code=204)


class APIBadRequest(APIException):
    """Exception raised when an API request is malformed."""

    def __init__(self, message: str = "Bad request") -> None:
        super().__init__("bad_request", message, status_code=400)


class APIUnauthorized(APIException):
    """Exception raised when an API request is unauthorized."""

    def __init__(
        self,
        message: str = "Unauthorized",
        error_id: str = "unauthorized",
    ) -> None:
        super().__init__(error_id, message, status_code=401)

    @staticmethod
    def raise_invalid_authorization_header() -> Never:
        """Raise an `APIUnauthorized` exception for an invalid authorization header."""
        error_id = "invalid_authorization_header"
        msg = "Invalid authorization header"

        raise APIUnauthorized(error_id, msg)


class APINotFound(APIException):
    """Exception raised when an API resource is not found."""

    def __init__(self, message: str = "Not found") -> None:
        super().__init__("not_found", message, status_code=404)


class APIForbidden(APIException):
    """Exception raised when an API request is forbidden."""

    def __init__(self, message: str = "Forbidden", error_id: str = "forbidden") -> None:
        super().__init__(error_id, message, status_code=403)


class APIInsufficientRights(APIForbidden):
    """Exception raised when the user has insufficient rights to make the request."""

    def __init__(self, message: str = "Insufficient rights") -> None:
        super().__init__(message, "insufficient_rights")


class APIConflict(APIException):
    """Exception raised when an API request conflicts with the current state."""

    def __init__(self, message: str = "Conflict", error_id: str = "conflict") -> None:
        super().__init__(error_id, message, status_code=409)


class APIUnprocessableEntity(APIException):
    """An exception raised when an API request is unprocessable.

    Raising this exception during request handling immediately returns a
    `422` (Unprocessable Entity) response to the client.
    """

    def __init__(self) -> None:
        super().__init__(
            "unprocessable_entity",
            "Unprocessable entity",
            status_code=422,
        )


@deprecated("Use `APIInvalidInput` instead.")
class APIInvalidQuery(APIUnprocessableEntity):
    """Raising this during request handling immediately returns a `422 Invalid Query`.

    This exception is raised when an an API request has invalid query parameters. The
    errors are generally the return value of a Cerberus validator.

    :TODO: Remove this class once all validation is handled by Pydantic.
    """

    def __init__(self, errors: dict) -> None:
        super().__init__()

        self.errors = errors
        self.id = "invalid_query"
        self.message = "Invalid query"


class APIInvalidInput(APIUnprocessableEntity):
    """Raising this during request handling immediately returns a `422 Invalid Input`.

    This exception is raised as a result of validation errors in the request body,
    query string, or headers. The errors are returned to the client in the response
    body.
    """

    def __init__(self, errors: list[dict]) -> None:
        super().__init__()

        self.errors = [] if errors is None else []
        """A list of errors that occurred during request processing.

        These will almost invariably be Pydantic 2 validation errors.
        """

        self.id = "invalid_input"
        self.message = "Invalid input"


class APIBadGateway(APIException):
    """Raising this during request handling immediately returns `502 Bad Gateway`.

    This exception should be raised only when the request fails because a downstream
    HTTP service is unavailable. For example, when a request to GitHub fails.
    """

    def __init__(
        self,
        message: str = "Bad gateway",
        error_id: str = "bad_gateway",
    ) -> None:
        super().__init__(error_id, message, status_code=502)


@middleware
async def error_middleware(req: Request, handler: Callable) -> StreamResponse:
    """Middleware for converting HTTP exceptions into HTTP responses.

    Catches any `APIException` raised during request handling and returns a response
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

        if isinstance(err, APIInvalidInput | APIInvalidQuery):
            body["errors"] = err.errors

        return json_response(
            body,
            status=err.status_code,
        )


def raise_api_exception(cls: type[APIException], msg: str) -> Never:
    """Raise an API exception with the given message."""
    raise cls(msg) from None
