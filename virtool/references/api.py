"""Request handlers for the API endpoints that deal with references.

TODO: Drop support for string group ids when we fully migrate to SQL.
"""

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import (
    r200,
    r403,
    r404,
)

from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APINotFound,
)
from virtool.api.routes import Routes
from virtool.data.errors import (
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.references.models import (
    Reference,
)

routes = Routes()


@routes.jobs_api.get("/references/v1/{ref_id}")
class ReferenceView(PydanticView):
    async def get(self, ref_id: int | str, /) -> r200[Reference] | r403 | r404:
        """Get a reference.

        Fetches the details of a reference.

        Status Codes:
            200: Successful operation
            403: Not permitted
            404: Not found

        """
        try:
            reference = await get_data_from_req(self.request).references.get(ref_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(reference)
