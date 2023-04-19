from typing import List, Union, Optional

from aiohttp.web_exceptions import HTTPBadRequest, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r404
from pydantic import Field

import virtool.http.routes
from virtool.api.response import EmptyRequest, NotFound, json_response
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.labels.oas import (
    CreateLabelRequest,
    UpdateLabelRequest,
    CreateLabelResponse,
    GetLabelResponse,
    LabelResponse,
)

routes = virtool.http.routes.Routes()


@routes.view("/spaces/{space_id}/labels")
@routes.view("/labels")
class LabelsView(PydanticView):
    async def get(
        self,
        find: Optional[str] = Field(
            description="Provide text to filter by partial matches to the name field."
        ),
    ) -> Union[r200[List[GetLabelResponse]], r400]:
        """
        List labels.

        Fetches a list of all sample labels on the instance. Pagination is not supported; all labels
        are included in the response.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        labels = await get_data_from_req(self.request).labels.find(term=find)

        return json_response([label.dict() for label in labels])

    async def post(
        self, data: CreateLabelRequest
    ) -> Union[r201[CreateLabelResponse], r400]:
        """
        Create a label.

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
            label = await get_data_from_req(self.request).labels.create(
                name=name, color=color, description=description
            )
        except ResourceConflictError:
            raise HTTPBadRequest(text="Label name already exists")

        headers = {"Location": f"/labels/{label.id}"}

        return json_response(label, status=201, headers=headers)


@routes.view("/spaces/{space_id}/labels/{label_id}")
@routes.view("/labels/{label_id}")
class LabelView(PydanticView):
    async def get(self, label_id: int, /) -> Union[r200[LabelResponse], r404]:
        """
        Get a label.

        Fetches the details for a sample label.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            label = await get_data_from_req(self.request).labels.get(label_id)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(label)

    async def patch(
        self, label_id: int, /, data: UpdateLabelRequest
    ) -> Union[r200[LabelResponse], r400, r404]:
        """
        Update a label.

        Updates an existing sample label.

        Status codes:
            200: Successful operation
            400: Invalid input
            404: Not found
        """
        if not data:
            raise EmptyRequest()

        try:
            label = await get_data_from_req(self.request).labels.update(
                label_id=label_id, data=data
            )
        except ResourceNotFoundError:
            raise NotFound()
        except ResourceConflictError:
            raise HTTPBadRequest(text="Label name already exists")

        return json_response(label)

    async def delete(self, label_id: int, /) -> Union[r204, r404]:
        """
        Delete a label.

        Deletes an existing sample label.

        Status Codes:
            204: Successful operation
            404: Not found
        """
        try:
            await get_data_from_req(self.request).labels.delete(label_id=label_id)
        except ResourceNotFoundError:
            raise NotFound()

        raise HTTPNoContent
