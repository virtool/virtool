from typing import Union, Optional

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r404, r409

from virtool.api.errors import APINotFound, APIConflict
from virtool.api.custom_json import json_response
from virtool.data.utils import get_data_from_req
from virtool.api.routes import Routes
from virtool.messages.oas import (
    MessageResponse,
    CreateMessageRequest,
    CreateMessageResponse,
    UpdateMessageResponse,
    UpdateMessageRequest,
)
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError

routes = Routes()


@routes.view("/instance_message")
class MessagesView(PydanticView):
    async def get(self) -> r200[Optional[MessageResponse]]:
        """
        Get the administrative instance message.

        Fetches the active administrative instance message.

        Status Codes:
            200: Successful operation
        """
        try:
            instance_message = await get_data_from_req(self.request).messages.get()
        except (ResourceNotFoundError, ResourceConflictError):
            return json_response(None)

        return json_response(instance_message)

    async def put(self, data: CreateMessageRequest) -> r200[CreateMessageResponse]:
        """
        Create an administrative instance message.

        Creates a new administrative instance message.

        Status Codes:
            200: Successful operation
        """
        user_id = self.request["client"].user_id

        instance_message = await get_data_from_req(self.request).messages.create(
            data, user_id
        )

        return json_response(
            instance_message, status=200, headers={"Location": "/instance_message"}
        )

    async def patch(
        self, data: UpdateMessageRequest
    ) -> Union[r200[UpdateMessageResponse], r404, r409]:
        """
        Update the administrative instance message.

        Updates the existing active administrative instance message.

        Status Codes:
            200: Successful operation
            404: Not found
            409: No active message set
        """
        try:
            instance_message = await get_data_from_req(self.request).messages.update(
                data
            )
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError:
            raise APIConflict("No active message set")

        return json_response(instance_message)
