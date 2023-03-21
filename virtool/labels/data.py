from typing import List

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine
from virtool_core.models.label import Label, LabelMinimal

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.labels.db import SampleCountTransform
from virtool.labels.models import Label as LabelSQL
from virtool.labels.oas import UpdateLabelRequest
from virtool.mongo.core import Mongo
from virtool.mongo.transforms import apply_transforms
from virtool.pg.utils import get_generic


class LabelsData:
    def __init__(self, db: Mongo, pg: AsyncEngine):
        self._db = db
        self._pg = pg

    async def find(self, term: str) -> List[LabelMinimal]:
        """
        List all sample labels.

        :param term: the query term
        :return: a list of all sample labels.
        """
        statement = select(LabelSQL).order_by(LabelSQL.name)

        if term:
            statement = statement.filter(LabelSQL.name.ilike(f"%{term}%"))

        labels = await get_generic(self._pg, statement)

        documents = await apply_transforms(
            [label.to_dict() for label in labels], [SampleCountTransform(self._db)]
        )

        return [LabelMinimal(**label) for label in documents]

    async def create(self, name: str, color: str, description: str) -> Label:
        """
        Create a new sample label given a label name, color and description.

        :param name: the label's name
        :param color: the label's color
        :param description: the label's description
        :return: the label
        """
        async with AsyncSession(self._pg) as session:
            label = LabelSQL(name=name, color=color, description=description)

            session.add(label)

            try:
                await session.flush()
                row = label.to_dict()
                await session.commit()
            except IntegrityError:
                raise ResourceConflictError()

        document = await apply_transforms(row, [SampleCountTransform(self._db)])

        return Label(**document)

    async def get(self, label_id: int) -> Label:
        """
        Get a single label by its ID.

        :param label_id: the label's ID
        :return: the label
        """

        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(LabelSQL).filter_by(id=label_id))
            label = result.scalar()

        if label is None:
            raise ResourceNotFoundError()

        document = await apply_transforms(
            label.to_dict(), [SampleCountTransform(self._db)]
        )

        return Label(**document)

    async def update(self, label_id: int, data: UpdateLabelRequest) -> Label:
        """
        Edit an existing label.

        :param label_id: the ID of the existing label to edit
        :param data: label fields for editing the existing label
        :return: the label
        """
        data = data.dict(exclude_unset=True)

        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(LabelSQL).filter_by(id=label_id))
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

        document = await apply_transforms(row, [SampleCountTransform(self._db)])

        return Label(**document)

    async def delete(self, label_id: int):
        """
        Delete an existing label.

        :param label_id: ID of the label to delete
        """
        async with AsyncSession(self._pg) as session:
            async with self._db.create_session() as mongo_session:
                result = await session.execute(select(LabelSQL).filter_by(id=label_id))
                label = result.scalar()

                if label is None:
                    raise ResourceNotFoundError()

                await self._db.samples.update_many(
                    {"labels": label_id},
                    {"$pull": {"labels": label_id}},
                    session=mongo_session,
                )

                await session.delete(label)
                await session.commit()
