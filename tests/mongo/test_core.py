from datetime import UTC, datetime, timedelta, timezone

import pytest

from virtool.mongo.core import Mongo


class TestEnforceNaiveUTC:
    """The Mongo write boundary enforces the naive-UTC datetime invariant."""

    async def test_insert_one_strips_aware_utc(self, mongo: Mongo):
        await mongo.samples.insert_one(
            {"_id": "sample", "created_at": datetime(2020, 1, 1, 12, tzinfo=UTC)},
        )

        document = await mongo.samples.find_one({"_id": "sample"})

        assert document["created_at"] == datetime(2020, 1, 1, 12)
        assert document["created_at"].tzinfo is None

    async def test_insert_one_rejects_aware_non_utc(self, mongo: Mongo):
        with pytest.raises(ValueError, match="aware non-UTC datetime"):
            await mongo.samples.insert_one(
                {
                    "_id": "sample",
                    "created_at": datetime(
                        2020, 1, 1, 12, tzinfo=timezone(timedelta(hours=-5))
                    ),
                },
            )

    async def test_update_one_strips_nested_aware_utc(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        await mongo.samples.update_one(
            {"_id": "sample"},
            {"$set": {"updated_at": datetime(2020, 1, 1, 12, tzinfo=UTC)}},
        )

        document = await mongo.samples.find_one({"_id": "sample"})

        assert document["updated_at"] == datetime(2020, 1, 1, 12)

    async def test_update_one_rejects_aware_non_utc(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        with pytest.raises(ValueError, match="aware non-UTC datetime"):
            await mongo.samples.update_one(
                {"_id": "sample"},
                {
                    "$set": {
                        "updated_at": datetime(
                            2020, 1, 1, 12, tzinfo=timezone(timedelta(hours=2))
                        ),
                    },
                },
            )
