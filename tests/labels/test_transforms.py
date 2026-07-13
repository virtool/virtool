from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.data.transforms import apply_transforms
from virtool.labels.sql import SQLLabel
from virtool.labels.transforms import AttachLabelsTransform


class TestAttachLabels:
    async def test_single(self, pg: AsyncEngine, snapshot: SnapshotAssertion):
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLLabel(
                        id=1, name="Bug", color="#a83432", description="This is a bug"
                    ),
                    SQLLabel(
                        id=2,
                        name="Question",
                        color="#03fc20",
                        description="This is a question",
                    ),
                ]
            )
            await session.commit()

        assert (
            await apply_transforms(
                {"id": "foo", "name": "Foo", "labels": [1, 2]},
                [AttachLabelsTransform(pg)],
                pg,
            )
            == snapshot
        )

    async def test_multi(self, pg: AsyncEngine, snapshot: SnapshotAssertion):
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLLabel(
                        id=1, name="Bug", color="#a83432", description="This is a bug"
                    ),
                    SQLLabel(
                        id=2,
                        name="Question",
                        color="#03fc20",
                        description="This is a question",
                    ),
                ]
            )
            await session.commit()

        assert (
            await apply_transforms(
                [
                    {"id": "foo", "name": "Foo", "labels": [2]},
                    {"id": "bar", "name": "Bar", "labels": [1, 2]},
                    {"id": "baz", "name": "Baz", "labels": []},
                ],
                [AttachLabelsTransform(pg)],
                pg,
            )
            == snapshot
        )
