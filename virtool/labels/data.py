from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emit, emits
from virtool.data.transforms import apply_transforms
from virtool.labels.oas import UpdateLabelRequest
from virtool.labels.sql import SQLLabel
from virtool.labels.transforms import AttachSampleCountsTransform
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_generic
from virtool_core.models.label import Label, LabelMinimal


class LabelsData:
    name = "labels"

    def __init__(self, mongo: Mongo, pg: AsyncEngine):
        self._mongo = mongo
        self._pg = pg

    async def find(self, term: str) -> list[LabelMinimal]:
        """List all sample labels.

        :param term: the query term
        :return: a list of all sample labels.
        """
        statement = select(SQLLabel).order_by(SQLLabel.name)

        if term:
            statement = statement.where(SQLLabel.name.ilike(f"%{term}%"))

        labels = await get_generic(self._pg, statement)

        documents = await apply_transforms(
            [label.to_dict() for label in labels],
            [AttachSampleCountsTransform(self._mongo)],
        )

        return [LabelMinimal(**label) for label in documents]

    @emits(Operation.CREATE)
    async def create(self, name: str, color: str, description: str) -> Label:
        """Create a new sample label given a label name, color and description.

        :param name: the label's name
        :param color: the label's color
        :param description: the label's description
        :return: the label
        """
        async with AsyncSession(self._pg) as session:
            label = SQLLabel(name=name, color=color, description=description)

            session.add(label)

            try:
                await session.flush()
                row = label.to_dict()
                await session.commit()
            except IntegrityError:
                raise ResourceConflictError()

        document = await apply_transforms(
            row,
            [AttachSampleCountsTransform(self._mongo)],
        )

        return Label(**document)

    async def get(self, label_id: int) -> Label:
        """Get a single label by its ID.

        :param label_id: the label's ID
        :return: the label
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLLabel).filter_by(id=label_id))
            label = result.scalar()

        if label is None:
            raise ResourceNotFoundError()

        document = await apply_transforms(
            label.to_dict(),
            [AttachSampleCountsTransform(self._mongo)],
        )

        return Label(**document)

    @emits(Operation.UPDATE)
    async def update(self, label_id: int, data: UpdateLabelRequest) -> Label:
        """Edit an existing label.

        :param label_id: the ID of the existing label to edit
        :param data: label fields for editing the existing label
        :return: the label
        """
        data = data.dict(exclude_unset=True)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLLabel).filter_by(id=label_id))
            label = result.scalar()

            if label is None:
                raise ResourceNotFoundError()

            if "name" in data:
                label.name = data["name"]

            if "color" in data:
                label.color = data["color"]

            if "description" in data:
                label.description = data["description"]

            row = label.to_dict()

            try:
                await session.commit()
            except IntegrityError:
                raise ResourceConflictError()

        document = await apply_transforms(
            row,
            [AttachSampleCountsTransform(self._mongo)],
        )

        return Label(**document)

    async def delete(self, label_id: int):
        """Delete an existing label.

        :param label_id: ID of the label to delete
        """
        label = await self.get(label_id)

        async with (
            AsyncSession(
                self._pg,
            ) as session,
            self._mongo.create_session() as mongo_session,
        ):
            result = await session.execute(select(SQLLabel).filter_by(id=label_id))
            label = result.scalar()

            if label is None:
                raise ResourceNotFoundError

            await self._mongo.samples.update_many(
                {"labels": label_id},
                {"$pull": {"labels": label_id}},
                session=mongo_session,
            )

            await session.delete(label)
            await session.commit()

        emit(label, "labels", "delete", Operation.DELETE)
