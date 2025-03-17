from pydantic import Field

import virtool.api.routes
from virtool.api.custom_json import json_response
from virtool.api.errors import APIBadRequest, APINoContent, APINotFound
from virtool.api.status import R200, R201, R204, R400, R404
from virtool.api.view import APIView
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.labels.oas import (
    LabelCreateRequest,
    LabelCreateResponse,
    LabelResponse,
    LabelUpdateRequest,
)

routes = virtool.api.routes.Routes()


@routes.web.view("/spaces/{space_id}/labels")
@routes.web.view("/labels")
class LabelsView(APIView):
    """Operations for multiple labels."""

    async def get(
        self,
        find: str | None = Field(
            description="Provide text to filter by partial matches to the name field.",
        ),
    ) -> R200[list[LabelResponse]] | R400:
        """List labels.

        Lists all sample labels on the instance. Pagination is not supported; all labels
        are included in the response.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        labels = await self.data.labels.find(term=find)
        return json_response(labels)

    async def post(self, data: LabelCreateRequest) -> R201[LabelCreateResponse] | R400:
        """Create a label.

        Creates a new sample label.

        The color must be a valid hexadecimal code.

        Status Codes:
            201: Successful operation
            400: Invalid Input
        """
        name = data.name
        color = data.color
        description = data.description

        try:
            label = await self.data.labels.create(
                name=name,
                color=color,
                description=description,
            )
        except ResourceConflictError:
            raise APIBadRequest("Label name already exists")

        return json_response(
            label,
            status=201,
            headers={"Location": f"/labels/{label.id}"},
        )


@routes.web.view("/spaces/{space_id}/labels/{label_id}")
@routes.web.view("/labels/{label_id}")
class LabelView(APIView):
    """Operations on a single label."""

    async def get(self, label_id: int, /) -> R200[LabelResponse] | R404:
        """Get a label.

        Fetches the details for a sample label.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            label = await self.data.labels.get(label_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(label)

    async def patch(
        self,
        label_id: int,
        /,
        data: LabelUpdateRequest,
    ) -> R200[LabelResponse] | R400 | R404:
        """Update a label.

        Updates an existing sample label.

        Status codes:
            200: Successful operation
            400: Invalid input
            404: Not found
        """
        try:
            label = await self.data.labels.update(
                label_id=label_id,
                data=data,
            )
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError:
            raise APIBadRequest("Label name already exists")

        return json_response(label)

    async def delete(self, label_id: int, /) -> R204 | R404:
        """Delete a label.

        Deletes an existing sample label.

        Status Codes:
            204: Successful operation
            404: Not found
        """
        try:
            await self.data.labels.delete(label_id)
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()
