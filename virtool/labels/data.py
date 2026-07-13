from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emit, emits
from virtool.labels.models import Label
from virtool.labels.sql import SQLLabel
from virtool.samples.sql import SQLLegacySampleLabel


class LabelsData:
    name = "labels"

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

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

        return Label(**row, count=0)

    async def delete(self, label_id: int) -> None:
        """Delete an existing label.

        :param label_id: ID of the label to delete
        """
        async with AsyncSession(self._pg) as pg_session:
            result = await pg_session.execute(
                select(SQLLabel).filter_by(id=label_id),
            )
            label = result.scalar()

            if label is None:
                raise ResourceNotFoundError

            await pg_session.execute(
                delete(SQLLegacySampleLabel).where(
                    SQLLegacySampleLabel.label_id == label_id,
                ),
            )

            await pg_session.delete(label)

            await pg_session.commit()

        emit(label, "labels", "delete", Operation.DELETE)
