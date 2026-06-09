from datetime import UTC, datetime, timedelta, timezone

import pytest

from virtool.mongo.core import Mongo

AWARE_UTC = datetime(2020, 1, 1, 12, tzinfo=UTC)
AWARE_NON_UTC = datetime(2020, 1, 1, 12, tzinfo=timezone(timedelta(hours=-5)))


class TestEnforceNaiveUTC:
    """The Mongo write boundary rejects any aware datetime, naive UTC only."""

    async def test_writes_naive(self, mongo: Mongo):
        await mongo.samples.insert_one(
            {"_id": "sample", "created_at": datetime(2020, 1, 1, 12)},
        )

        document = await mongo.samples.find_one({"_id": "sample"})

        assert document["created_at"] == datetime(2020, 1, 1, 12)
        assert document["created_at"].tzinfo is None

    async def test_insert_one_rejects_aware(self, mongo: Mongo):
        with pytest.raises(ValueError, match="aware datetime"):
            await mongo.samples.insert_one(
                {"_id": "sample", "created_at": AWARE_UTC},
            )

    async def test_update_one_rejects_aware(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        with pytest.raises(ValueError, match="aware datetime"):
            await mongo.samples.update_one(
                {"_id": "sample"},
                {"$set": {"updated_at": AWARE_UTC}},
            )

    async def test_update_many_rejects_aware(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        with pytest.raises(ValueError, match="aware datetime"):
            await mongo.samples.update_many(
                {},
                {"$set": {"updated_at": AWARE_UTC}},
            )

    async def test_replace_one_rejects_aware(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        with pytest.raises(ValueError, match="aware datetime"):
            await mongo.samples.replace_one(
                {"_id": "sample"},
                {"_id": "sample", "created_at": AWARE_UTC},
            )

    async def test_find_one_and_update_rejects_aware(self, mongo: Mongo):
        await mongo.samples.insert_one({"_id": "sample"})

        with pytest.raises(ValueError, match="aware datetime"):
            await mongo.samples.find_one_and_update(
                {"_id": "sample"},
                {"$set": {"updated_at": AWARE_UTC}},
            )

    async def test_insert_many_rejects_aware(self, mongo: Mongo):
        with pytest.raises(ValueError, match="aware datetime"):
            await mongo.samples.insert_many(
                [{"_id": "one", "created_at": AWARE_UTC}],
                session=None,
            )

    async def test_rejects_aware_non_utc(self, mongo: Mongo):
        with pytest.raises(ValueError, match="aware datetime"):
            await mongo.samples.insert_one(
                {"_id": "sample", "created_at": AWARE_NON_UTC},
            )

    async def test_rejects_datetime_nested_in_tuple(self, mongo: Mongo):
        with pytest.raises(ValueError, match="aware datetime"):
            await mongo.samples.insert_one(
                {"_id": "sample", "events": ({"at": AWARE_UTC},)},
            )
