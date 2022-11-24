from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.instancemessage import InstanceMessage

import virtool.utils
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.messages.models import SQLInstanceMessage
from virtool.messages.oas import CreateMessageRequest, UpdateMessageRequest
from virtool.mongo.core import DB
from virtool.mongo.transforms import apply_transforms
from virtool.users.db import AttachUserTransform


class MessagesData:

    def __init__(self, pg: AsyncEngine, mongo: DB):
        self._pg = pg
        self._mongo = mongo

    async def get(self) -> InstanceMessage:
        """
        Get the active administrative instance message.
        """

        async with AsyncSession(self._pg) as session:
            instance_message = (
                await session.execute(select(SQLInstanceMessage).order_by(SQLInstanceMessage.id.desc()))
            ).first()[0]

        if instance_message and instance_message.active:
            document = instance_message.to_dict()
            document = await apply_transforms(document, [AttachUserTransform(self._mongo)])
            return InstanceMessage(**document)

        raise ResourceNotFoundError()

    async def create(self, data: CreateMessageRequest, user_id: str) -> InstanceMessage:
        """
        Create an administrative instance message.
        """

        instance_message = SQLInstanceMessage(
            color=data.color,
            message=data.message,
            created_at=virtool.utils.timestamp(),
            updated_at=virtool.utils.timestamp(),
            user=user_id
        )

        async with AsyncSession(self._pg) as session:
            session.add(instance_message)
            await session.flush()
            document = instance_message.to_dict()
            await session.commit()

        document = await apply_transforms(document, [AttachUserTransform(self._mongo)])

        return InstanceMessage(**document)

    async def update(self, data: UpdateMessageRequest) -> InstanceMessage:
        """
        Update the active administrative instance message.
        """

        async with AsyncSession(self._pg) as session:
            instance_message = (
                await session.execute(select(SQLInstanceMessage).order_by(SQLInstanceMessage.id.desc()))
            ).first()[0]

            if not instance_message:
                raise ResourceNotFoundError()

            if not instance_message.active:
                raise ResourceConflictError("The message is inactive")

            if data.color is not None:
                instance_message.color = data.color

            if data.message is not None:
                instance_message.message = data.message
                instance_message.updated_at = virtool.utils.timestamp()

            if data.active is not None:
                instance_message.active = False

            document = instance_message.to_dict()

            await session.commit()

        document = await apply_transforms(document, [AttachUserTransform(self._mongo)])

        return InstanceMessage(**document)
