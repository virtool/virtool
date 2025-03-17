from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.instancemessage import InstanceMessage

import virtool.utils
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.transforms import apply_transforms
from virtool.messages.models import SQLInstanceMessage
from virtool.messages.oas import MessageCreateRequest, MessageUpdateRequest
from virtool.mongo.core import Mongo
from virtool.users.transforms import AttachUserTransform
from virtool.validation import is_set


class MessagesData:
    def __init__(self, pg: AsyncEngine, mongo: Mongo):
        self._pg = pg
        self._mongo = mongo

    async def get(self) -> InstanceMessage:
        """Get the active administrative instance message."""
        async with AsyncSession(self._pg) as session:
            instance_message = (
                await session.execute(
                    select(SQLInstanceMessage).order_by(SQLInstanceMessage.id.desc()),
                )
            ).first()

        if not instance_message:
            raise ResourceNotFoundError

        instance_message = instance_message[0]

        if instance_message.active:
            document = instance_message.to_dict()
            document = await apply_transforms(
                document,
                [AttachUserTransform(self._mongo)],
            )
            return InstanceMessage(**document)

        raise ResourceConflictError

    async def create(self, data: MessageCreateRequest, user_id: str) -> InstanceMessage:
        """Create an administrative instance message."""
        instance_message = SQLInstanceMessage(
            color=data.color,
            message=data.message,
            created_at=virtool.utils.timestamp(),
            updated_at=virtool.utils.timestamp(),
            user=user_id,
        )

        async with AsyncSession(self._pg) as session:
            session.add(instance_message)
            await session.flush()
            document = instance_message.to_dict()
            await session.commit()

        document = await apply_transforms(document, [AttachUserTransform(self._mongo)])

        return InstanceMessage(**document)

    async def update(self, data: MessageUpdateRequest) -> InstanceMessage:
        """Update the active administrative instance message."""
        async with AsyncSession(self._pg) as session:
            message = (
                await session.execute(
                    select(SQLInstanceMessage).order_by(SQLInstanceMessage.id.desc()),
                )
            ).one_or_none()

            if not message:
                raise ResourceNotFoundError

            if not message.active:
                raise ResourceConflictError("The message is inactive")

            if is_set(data.color):
                message.color = data["color"]

            if is_set(data.message):
                message.message = data["message"]
                message.updated_at = virtool.utils.timestamp()

            if is_set(data.active):
                message.active = data["active"]

            message_dict = message.to_dict()

            await session.commit()

        return InstanceMessage.model_validate(
            await apply_transforms(
                message_dict,
                [AttachUserTransform(self._mongo)],
            ),
        )
