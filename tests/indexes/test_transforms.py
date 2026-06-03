import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.transforms import apply_transforms
from virtool.indexes.transforms import AttachIndexTransform
from virtool.mongo.core import Mongo


class TestAttachIndexTransform:
    async def test_single(self, mongo: Mongo, pg: AsyncEngine):
        await mongo.indexes.insert_one({"_id": "index_1", "version": 3})

        assert await apply_transforms(
            {"id": "analysis_1", "index": {"id": "index_1"}},
            [AttachIndexTransform(mongo)],
            pg,
        ) == {"id": "analysis_1", "index": {"id": "index_1", "version": 3}}

    async def test_multi(self, mongo: Mongo, pg: AsyncEngine):
        await mongo.indexes.insert_many(
            [{"_id": "index_1", "version": 3}, {"_id": "index_2", "version": 7}],
            session=None,
        )

        documents = [
            {"id": "analysis_1", "index": {"id": "index_1"}},
            {"id": "analysis_2", "index": {"id": "index_2"}},
            {"id": "analysis_3", "index": {"id": "index_1"}},
        ]

        assert await apply_transforms(documents, [AttachIndexTransform(mongo)], pg) == [
            {"id": "analysis_1", "index": {"id": "index_1", "version": 3}},
            {"id": "analysis_2", "index": {"id": "index_2", "version": 7}},
            {"id": "analysis_3", "index": {"id": "index_1", "version": 3}},
        ]

    async def test_missing_index_single(self, mongo: Mongo, pg: AsyncEngine):
        with pytest.raises(ValueError, match="Index not found: index_gone"):
            await apply_transforms(
                {"id": "analysis_1", "index": {"id": "index_gone"}},
                [AttachIndexTransform(mongo)],
                pg,
            )

    async def test_missing_index_multi(self, mongo: Mongo, pg: AsyncEngine):
        await mongo.indexes.insert_one({"_id": "index_1", "version": 3})

        with pytest.raises(ValueError, match="Indexes not found"):
            await apply_transforms(
                [
                    {"id": "analysis_1", "index": {"id": "index_1"}},
                    {"id": "analysis_2", "index": {"id": "index_gone"}},
                ],
                [AttachIndexTransform(mongo)],
                pg,
            )
