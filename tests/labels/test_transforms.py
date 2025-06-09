from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.data.transforms import apply_transforms
from virtool.labels.sql import SQLLabel
from virtool.labels.transforms import AttachLabelsTransform, AttachSampleCountsTransform
from virtool.mongo.core import Mongo


class TestAttachSampleCounts:
    async def test_single(self, mongo: Mongo, snapshot: SnapshotAssertion):
        await mongo.samples.insert_many(
            [
                {"_id": "foo", "name": "Foo", "labels": [1, 2, 4]},
                {"_id": "bar", "name": "Bar", "labels": []},
                {"_id": "baz", "name": "Baz", "labels": [2]},
            ],
            session=None,
        )

        assert (
            await apply_transforms(
                {
                    "id": 1,
                    "name": "Bug",
                    "color": "#a83432",
                    "description": "This is a bug",
                },
                [AttachSampleCountsTransform(mongo)],
            )
            == snapshot
        )

    async def test_multiple(self, mongo: Mongo, snapshot: SnapshotAssertion):
        await mongo.samples.insert_many(
            [
                {"_id": "foo", "name": "Foo", "labels": [1, 2, 4]},
                {"_id": "bar", "name": "Bar", "labels": []},
                {"_id": "baz", "name": "Baz", "labels": [2]},
            ],
            session=None,
        )

        assert (
            await apply_transforms(
                [
                    {
                        "id": 2,
                        "name": "Question",
                        "color": "#03fc20",
                        "description": "This is a question",
                    },
                    {
                        "id": 3,
                        "name": "Info",
                        "color": "#02db21",
                        "description": "This is a info",
                    },
                ],
                [AttachSampleCountsTransform(mongo)],
            )
            == snapshot
        )


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
            )
            == snapshot
        )
