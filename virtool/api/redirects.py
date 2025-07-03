"""Redirect middleware for handling URL redirects."""

from aiohttp.web import middleware
from aiohttp.web_exceptions import HTTPMovedPermanently


@middleware
async def redirect_middleware(request, handler):
    """Middleware to handle URL redirects."""
    path = request.path

    if path.startswith("/refs") or (
        path.startswith("/references") and not path.startswith("/references/v1")
    ):
        # Replace /references or /refs with /references/v1
        if path.startswith("/references"):
            new_path = path.replace("/references", "/references/v1", 1)
        else:
            new_path = path.replace("/refs", "/references/v1", 1)

        # Preserve query parameters
        if request.query_string:
            new_path += f"?{request.query_string}"

        # Use relative redirect to avoid DNS issues in tests
        raise HTTPMovedPermanently(location=new_path)

    return await handler(request)
