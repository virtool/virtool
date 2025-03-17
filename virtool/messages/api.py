from virtool.api.custom_json import json_response
from virtool.api.errors import APIConflict, APINotFound
from virtool.api.routes import Routes
from virtool.api.status import R200, R404, R409
from virtool.api.view import APIView
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.messages.oas import (
    CreateMessageResponse,
    MessageCreateRequest,
    MessageResponse,
    MessageUpdateRequest,
    UpdateMessageResponse,
)

routes = Routes()


@routes.web.view("/instance_message")
class MessagesView(APIView):
    async def get(self) -> R200[MessageResponse | None]:
        """Get the administrative instance message.

        Fetches the active administrative instance message.

        Status Codes:
            200: Successful operation
        """
        try:
            instance_message = await self.data.messages.get()
        except (ResourceNotFoundError, ResourceConflictError):
            return json_response(None)

        return json_response(instance_message)

    async def put(self, data: MessageCreateRequest) -> R200[CreateMessageResponse]:
        """Create an administrative instance message.

        Creates a new administrative instance message.

        Status Codes:
            200: Successful operation
        """
        user_id = self.request["client"].user_id

        instance_message = await self.data.messages.create(
            data,
            user_id,
        )

        return json_response(
            instance_message,
            status=200,
            headers={"Location": "/instance_message"},
        )

    async def patch(
        self,
        data: MessageUpdateRequest,
    ) -> R200[UpdateMessageResponse] | R404 | R409:
        """Update the administrative instance message.

        Updates the existing active administrative instance message.

        Status Codes:
            200: Successful operation
            404: Not found
            409: No active message set
        """
        try:
            instance_message = await self.data.messages.update(
                data,
            )
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError:
            raise APIConflict("No active message set")

        return json_response(instance_message)
