"""Reusable constrained types for validating pagination query parameters.

Declare these on ``PydanticView`` list handlers so that ``page`` and ``per_page``
are validated at the API boundary. Out-of-range values are rejected with a ``400``
before reaching the pagination math, letting the data layer trust the values it
receives.

Usage::

    async def get(self, page: Page = 1, per_page: PerPage = 25) -> ...:
        ...
"""

from pydantic import conint

Page = conint(ge=1)
"""The one-indexed page number to return. Must be at least ``1``."""

PerPage = conint(ge=1, le=100)
"""The number of documents per page. Must be between ``1`` and ``100``."""
