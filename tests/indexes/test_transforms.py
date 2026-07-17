import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.transforms import apply_transforms
from virtool.fake.next import DataFaker
from virtool.indexes.transforms import AttachIndexTransform
from virtool.mongo.core import Mongo


class TestAttachIndexTransform:
    async def test_single(self, fake: DataFaker, mongo: Mongo, pg: AsyncEngine):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        index = await fake.indexes.create(reference, user, version=3)

        assert await apply_transforms(
            {"id": "analysis_1", "index": {"id": index.id}},
            [AttachIndexTransform(mongo)],
            pg,
        ) == {"id": "analysis_1", "index": {"id": index.id, "version": 3}}

    async def test_multi(self, fake: DataFaker, mongo: Mongo, pg: AsyncEngine):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)

        index_1 = await fake.indexes.create(reference, user, version=3)
        index_2 = await fake.indexes.create(reference, user, version=7)

        documents = [
            {"id": "analysis_1", "index": {"id": index_1.id}},
            {"id": "analysis_2", "index": {"id": index_2.id}},
            {"id": "analysis_3", "index": {"id": index_1.id}},
        ]

        assert await apply_transforms(documents, [AttachIndexTransform(mongo)], pg) == [
            {"id": "analysis_1", "index": {"id": index_1.id, "version": 3}},
            {"id": "analysis_2", "index": {"id": index_2.id, "version": 7}},
            {"id": "analysis_3", "index": {"id": index_1.id, "version": 3}},
        ]

    async def test_missing_index_single(self, mongo: Mongo, pg: AsyncEngine):
        with pytest.raises(ValueError, match="Index not found: index_gone"):
            await apply_transforms(
                {"id": "analysis_1", "index": {"id": "index_gone"}},
                [AttachIndexTransform(mongo)],
                pg,
            )

    async def test_missing_index_multi(
        self, fake: DataFaker, mongo: Mongo, pg: AsyncEngine
    ):
        user = await fake.users.create()
        reference = await fake.references.create(user=user)
        index = await fake.indexes.create(reference, user, version=3)

        with pytest.raises(ValueError, match="Indexes not found"):
            await apply_transforms(
                [
                    {"id": "analysis_1", "index": {"id": index.id}},
                    {"id": "analysis_2", "index": {"id": "index_gone"}},
                ],
                [AttachIndexTransform(mongo)],
                pg,
            )
