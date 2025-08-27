import asyncio
from functools import wraps

from aiohttp import (
    ClientError,
    ClientResponse,
    ContentTypeError,
)
from structlog import get_logger

from virtool.workflow.errors import (
    JobsAPIBadRequestError,
    JobsAPIConflictError,
    JobsAPIForbiddenError,
    JobsAPINotFoundError,
    JobsAPIServerError,
)

logger = get_logger("api")

API_CHUNK_SIZE = 1024 * 1024 * 2
"""The size of chunks to use when downloading files from the API in bytes."""

API_MAX_RETRIES = 5
"""The maximum number of retries for API requests."""

API_RETRY_BASE_DELAY = 5.0
"""The base delay in seconds between retries for API requests."""


def retry(
    func=None,
    *,
    max_retries: int = API_MAX_RETRIES,
    base_delay: float = API_RETRY_BASE_DELAY,
):
    """Retry the decorated function on connection errors.

    :param func: The function to decorate (when used without parentheses)
    :param max_retries: Maximum number of retry attempts before giving up (default: 5)
    :param base_delay: Base delay in seconds between retries (default: 5.0)
    """

    def decorator(f):
        @wraps(f)
        async def wrapper(*args, **kwargs):
            last_exception = None

            log = logger.bind(func_name=f.__name__, max_retries=max_retries)

            for attempt in range(max_retries + 1):
                try:
                    return await f(*args, **kwargs)
                except (
                    ClientError,
                    ConnectionError,
                ) as e:
                    last_exception = e

                    if attempt == max_retries:
                        log.warning(
                            "max retries reached for function",
                            exception=str(e),
                        )
                        raise

                    # Use exponential backoff if base_delay != 5.0, otherwise use
                    # fixed delay.
                    if base_delay == API_RETRY_BASE_DELAY:
                        delay = base_delay
                    else:
                        delay = base_delay * (2**attempt)

                    log.info(
                        "retrying after connection error",
                        exception=str(e),
                        retries=attempt,
                        retrying_in=delay,
                    )

                    await asyncio.sleep(delay)

            raise last_exception

        return wrapper

    if func is None:
        return decorator

    return decorator(func)


async def decode_json_response(resp: ClientResponse) -> dict | list | None:
    """Decode a JSON response from a :class:``ClientResponse``.

    Raise a :class:`ValueError` if the response is not JSON.

    :param resp: the response to decode
    :return: the decoded JSON
    """
    try:
        return await resp.json()
    except ContentTypeError:
        raise ValueError(f"Response from  {resp.url} was not JSON. {await resp.text()}")


async def raise_exception_by_status_code(resp: ClientResponse) -> None:
    """Raise an exception based on the status code of the response.

    :param resp: the response to check
    :raise JobsAPIBadRequest: the response status code is 400
    :raise JobsAPIForbidden: the response status code is 403
    :raise JobsAPINotFound: the response status code is 404
    :raise JobsAPIConflict: the response status code is 409
    :raise JobsAPIServerError: the response status code is 500
    """
    status_exception_map = {
        400: JobsAPIBadRequestError,
        403: JobsAPIForbiddenError,
        404: JobsAPINotFoundError,
        409: JobsAPIConflictError,
        500: JobsAPIServerError,
    }

    try:
        resp_json: dict | None = await resp.json()
    except ContentTypeError:
        resp_json = None

    if resp.status not in range(200, 299):
        if resp_json is None:
            try:
                message = await resp.text()
            except UnicodeDecodeError:
                message = "Could not decode response message"
        else:
            message = resp_json["message"] if "message" in resp_json else str(resp_json)

        if resp.status in status_exception_map:
            raise status_exception_map[resp.status](message)
        raise ValueError(
            f"Status code {resp.status} not handled for response\n {resp}",
        )
