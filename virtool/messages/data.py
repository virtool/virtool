from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.transforms import apply_transforms
from virtool.messages.models import InstanceMessage
from virtool.messages.oas import CreateMessageRequest, UpdateMessageRequest
from virtool.messages.sql import SQLInstanceMessage
from virtool.users.transforms import AttachUserTransform


class MessagesData:
    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def get(self) -> InstanceMessage:
        """Get the active administrative instance message."""
        async with AsyncSession(self._pg) as session:
            instance_message = (
                await session.execute(
                    select(SQLInstanceMessage).order_by(SQLInstanceMessage.id.desc())
                )
            ).first()

        if not instance_message:
            raise ResourceNotFoundError

        instance_message = instance_message[0]

        if instance_message.active:
            document = instance_message.to_dict()
            document = await apply_transforms(document, [AttachUserTransform(self._pg)])
            return InstanceMessage(**document)

        raise ResourceConflictError

    async def create(self, data: CreateMessageRequest, user_id: str) -> InstanceMessage:
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

        document = await apply_transforms(document, [AttachUserTransform(self._pg)])

        return InstanceMessage(**document)

    async def update(self, data: UpdateMessageRequest) -> InstanceMessage:
        """Update the active administrative instance message."""
        data = data.dict(exclude_unset=True)

        async with AsyncSession(self._pg) as session:
            instance_message = (
                await session.execute(
                    select(SQLInstanceMessage).order_by(SQLInstanceMessage.id.desc())
                )
            ).first()

            if not instance_message:
                raise ResourceNotFoundError

            instance_message = instance_message[0]

            if not instance_message.active:
                raise ResourceConflictError("The message is inactive")

            if "color" in data:
                instance_message.color = data["color"]

            if "message" in data:
                instance_message.message = data["message"]
                instance_message.updated_at = virtool.utils.timestamp()

            if "active" in data:
                instance_message.active = data["active"]

            document = instance_message.to_dict()

            await session.commit()

        document = await apply_transforms(document, [AttachUserTransform(self._pg)])

        return InstanceMessage(**document)
