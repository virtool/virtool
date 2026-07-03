from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r400
from pydantic import Field

from virtool.api.custom_json import json_response
from virtool.api.pagination import Page, PerPage
from virtool.api.routes import Routes
from virtool.data.utils import get_data_from_req
from virtool.users.models import User

routes = Routes()


@routes.view("/users")
class UsersView(PydanticView):
    """A view for listing users."""

    async def get(
        self,
        active: bool = Field(
            default=True,
            description="Filter by active status.",
        ),
        find: str | None = Field(
            description="Filter by partial matches to user handles.",
        ),
        page: Page = 1,
        per_page: PerPage = 25,
    ) -> r200[User] | r400:
        """Find users.

        Find all Virtool users.

        The ``active`` query parameter can be used to filter users by their active
        status.

        The ``find`` query parameter can be used to filter users by partial matches to
        their handles.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        result = await get_data_from_req(self.request).users.find(
            page=page,
            per_page=per_page,
            active=active,
            administrator=None,
            term=find or "",
        )

        return json_response(
            {
                "documents": [user.dict() for user in result.items],
                "found_count": result.found_count,
                "page": result.page,
                "page_count": result.page_count,
                "per_page": result.per_page,
                "total_count": result.total_count,
            }
        )
